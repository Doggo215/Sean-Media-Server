#!/usr/bin/env python3
"""
Media Drop — Sean Media Server automatic import service.

Watches ~/Desktop/Media Drop/* for new files, copies them to the
media server via SMB, triggers Jellyfin scans, and sends macOS
notifications. Runs as a macOS Launch Agent.
"""

import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from queue import Queue
from threading import Thread

try:
    import requests
except ImportError:
    print("Missing dependency: pip3 install requests watchdog")
    sys.exit(1)

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer
except ImportError:
    print("Missing dependency: pip3 install requests watchdog")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CONFIG_PATH = Path(__file__).parent / "config.json"

def load_config() -> dict:
    with open(CONFIG_PATH) as f:
        cfg = json.load(f)
    cfg["media_drop_path"] = Path(cfg["media_drop_path"]).expanduser()
    cfg["log_path"] = Path(cfg["log_path"]).expanduser()
    return cfg


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def setup_logging(log_path: Path) -> logging.Logger:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("MediaDrop")
    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S")
    fh = logging.FileHandler(log_path)
    fh.setFormatter(fmt)
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger


# ---------------------------------------------------------------------------
# macOS notifications
# ---------------------------------------------------------------------------

def notify(title: str, message: str, subtitle: str = "") -> None:
    script = f'display notification "{message}" with title "{title}"'
    if subtitle:
        script += f' subtitle "{subtitle}"'
    subprocess.run(["osascript", "-e", script], capture_output=True)


# ---------------------------------------------------------------------------
# SMB mount management
# ---------------------------------------------------------------------------

def is_mounted(mount_point: Path) -> bool:
    return mount_point.exists() and any(mount_point.iterdir())


def mount_share(server: str, user: str, share: str, mount_point: Path, cfg: dict, log: logging.Logger) -> bool:
    if is_mounted(mount_point):
        return True
    mount_point.mkdir(parents=True, exist_ok=True)
    smb_url = f"smb://{user}@{server}/{share}"
    log.info(f"Mounting {smb_url} → {mount_point}")
    # Use open to trigger Finder mount (asks keychain for password)
    result = subprocess.run(
        ["osascript", "-e",
         f'mount volume "{smb_url}"'],
        capture_output=True, text=True, timeout=15
    )
    time.sleep(2)
    if is_mounted(mount_point):
        log.info(f"Mounted successfully: {mount_point}")
        return True
    log.error(f"Mount failed: {result.stderr}")
    return False


def ensure_server_reachable(cfg: dict, log: logging.Logger) -> bool:
    media_mount = Path(cfg["smb_mount_base"]) / cfg["smb_shares"]["media"]
    if is_mounted(media_mount):
        return True
    log.warning("SMB share not mounted. Attempting to mount via Finder...")
    return mount_share(
        cfg["smb_server"], cfg["smb_user"],
        cfg["smb_shares"]["media"], media_mount, cfg, log
    )


# ---------------------------------------------------------------------------
# File stability check
# ---------------------------------------------------------------------------

def wait_for_stable(path: Path, wait: float, checks: int, log: logging.Logger) -> bool:
    """Return True when file size stops changing."""
    log.debug(f"Waiting for {path.name} to finish copying...")
    prev_size = -1
    stable_count = 0
    for _ in range(checks * 10):
        try:
            current_size = path.stat().st_size
        except OSError:
            time.sleep(1)
            continue
        if current_size == prev_size and current_size > 0:
            stable_count += 1
            if stable_count >= checks:
                log.debug(f"{path.name} stable at {current_size:,} bytes")
                return True
        else:
            stable_count = 0
        prev_size = current_size
        time.sleep(wait / checks)
    log.warning(f"{path.name} never stabilized")
    return False


def is_readable(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            f.read(4096)
        return True
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Filename parsing
# ---------------------------------------------------------------------------

MOVIE_RE = re.compile(r"^(.+?)\s*\((\d{4})\)", re.IGNORECASE)
TV_RE    = re.compile(r"^(.+?)\s*[Ss](\d+)[Ee](\d+)", re.IGNORECASE)

def parse_movie(name: str) -> dict | None:
    m = MOVIE_RE.match(name)
    if m:
        return {"title": m.group(1).strip(), "year": m.group(2)}
    return None

def parse_tv(name: str) -> dict | None:
    m = TV_RE.match(name)
    if m:
        return {
            "show": m.group(1).strip(),
            "season": int(m.group(2)),
            "episode": int(m.group(3)),
        }
    return None


# ---------------------------------------------------------------------------
# Destination path builder
# ---------------------------------------------------------------------------

def build_destination(src_folder: str, file_path: Path, cfg: dict, log: logging.Logger) -> Path | None:
    """
    Returns the full destination path on the server for a given file.
    """
    media_root = Path(cfg["smb_mount_base"]) / cfg["smb_shares"]["media"]
    server_folder = cfg["folder_map"].get(src_folder)
    if not server_folder:
        log.warning(f"No folder mapping for '{src_folder}', routing to home-videos")
        server_folder = "home-videos"

    stem = file_path.stem
    suffix = file_path.suffix

    if src_folder == "Movies":
        parsed = parse_movie(stem)
        if parsed:
            folder_name = f"{parsed['title']} ({parsed['year']})"
            dest_dir = media_root / server_folder / folder_name
            return dest_dir / f"{folder_name}{suffix}"
        else:
            # No year detected — put in folder named after file stem
            dest_dir = media_root / server_folder / stem
            return dest_dir / file_path.name

    elif src_folder == "TV Shows":
        parsed = parse_tv(stem)
        if parsed:
            season_str = f"Season {parsed['season']:02d}"
            dest_dir = media_root / server_folder / parsed["show"] / season_str
            return dest_dir / file_path.name
        else:
            dest_dir = media_root / server_folder / stem
            return dest_dir / file_path.name

    elif src_folder == "Music":
        dest_dir = media_root / server_folder
        return dest_dir / file_path.name

    elif src_folder in ("Home Videos", "Unknown"):
        year = datetime.now().strftime("%Y")
        dest_dir = media_root / server_folder / year
        return dest_dir / file_path.name

    elif src_folder == "Family Photos":
        year = datetime.now().strftime("%Y")
        dest_dir = media_root / server_folder / year
        return dest_dir / file_path.name

    else:
        dest_dir = media_root / server_folder
        return dest_dir / file_path.name


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------

def is_duplicate(src: Path, dest: Path, log: logging.Logger) -> bool:
    if not dest.exists():
        return False
    src_size  = src.stat().st_size
    dest_size = dest.stat().st_size
    if src_size == dest_size and src.name == dest.name:
        log.warning(f"Duplicate detected: {dest.name} already exists with same size")
        return True
    return False


# ---------------------------------------------------------------------------
# Jellyfin
# ---------------------------------------------------------------------------

class JellyfinClient:
    def __init__(self, url: str, api_key: str, log: logging.Logger):
        self.base = url.rstrip("/")
        self.key  = api_key
        self.log  = log
        self.headers = {"Authorization": f"MediaBrowser Token={api_key}"}

    def scan(self) -> bool:
        try:
            r = requests.post(f"{self.base}/Library/Refresh", headers=self.headers, timeout=10)
            self.log.info(f"Jellyfin scan triggered: HTTP {r.status_code}")
            return r.status_code in (200, 204)
        except requests.RequestException as e:
            self.log.error(f"Jellyfin scan failed: {e}")
            return False

    def wait_for_item(self, filename_stem: str, timeout: int = 60) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                r = requests.get(
                    f"{self.base}/Items",
                    headers=self.headers,
                    params={"searchTerm": filename_stem, "Recursive": "true", "Limit": "5"},
                    timeout=10,
                )
                items = r.json().get("Items", [])
                if items:
                    self.log.info(f"Jellyfin confirmed: '{items[0]['Name']}'")
                    return True
            except Exception:
                pass
            time.sleep(5)
        return False


# ---------------------------------------------------------------------------
# Import worker
# ---------------------------------------------------------------------------

class ImportJob:
    def __init__(self, src_path: Path, src_folder: str):
        self.src_path   = src_path
        self.src_folder = src_folder
        self.started    = datetime.now()


def process_import(job: ImportJob, cfg: dict, jellyfin: JellyfinClient, log: logging.Logger) -> None:
    src  = job.src_path
    name = src.name
    log.info(f"▶ Import started: {name} (from {job.src_folder}/)")

    failed_dir = cfg["media_drop_path"] / "Failed"
    failed_dir.mkdir(exist_ok=True)

    # 1. Wait for copy to complete
    if not wait_for_stable(src, cfg["stability_wait_seconds"], cfg["stability_checks"], log):
        log.error(f"File never stabilized: {name}")
        shutil.move(str(src), str(failed_dir / name))
        notify("Media Drop — Failed", f"{name} never finished copying.", "Check Media Drop/Failed/")
        return

    # 2. Verify readable
    if not is_readable(src):
        log.error(f"File not readable: {name}")
        shutil.move(str(src), str(failed_dir / name))
        notify("Media Drop — Failed", f"{name} could not be read.", "Check Media Drop/Failed/")
        return

    # 3. Ensure server is reachable
    if not ensure_server_reachable(cfg, log):
        log.error("Server unreachable — moving to Failed")
        shutil.move(str(src), str(failed_dir / name))
        notify("Media Drop — Server Offline", f"Could not reach media-server. {name} moved to Failed.", "")
        return

    # 4. Build destination
    dest = build_destination(job.src_folder, src, cfg, log)
    if dest is None:
        log.error(f"Could not determine destination for {name}")
        shutil.move(str(src), str(failed_dir / name))
        return

    log.info(f"Destination: {dest}")

    # 5. Duplicate check
    if is_duplicate(src, dest, log):
        log.warning(f"Skipping duplicate: {name}")
        notify("Media Drop — Duplicate", f"{name} already exists on the server.", "File left in Media Drop folder.")
        return

    # 6. Copy to server
    dest.parent.mkdir(parents=True, exist_ok=True)
    log.info(f"Copying {name} → {dest}")
    try:
        shutil.copy2(str(src), str(dest))
    except Exception as e:
        log.error(f"Copy failed: {e}")
        notify("Media Drop — Copy Failed", f"{name} could not be copied.", str(e))
        return

    # 7. Verify copy succeeded
    if not dest.exists() or dest.stat().st_size != src.stat().st_size:
        log.error(f"Copy verification failed for {name}")
        notify("Media Drop — Failed", f"{name} copy could not be verified.", "")
        return

    log.info(f"Copy verified: {dest.stat().st_size:,} bytes")

    # 8. Trigger Jellyfin scan
    jellyfin.scan()

    # 9. Wait for Jellyfin to index
    log.info("Waiting for Jellyfin to index...")
    found = jellyfin.wait_for_item(src.stem, timeout=cfg["scan_wait_seconds"])

    # 10. Notify
    display_name = src.stem
    if found:
        log.info(f"✅ Import complete: {display_name}")
        notify("Media Drop", f"{display_name} added successfully.", "Now available in Jellyfin")
    else:
        log.warning(f"File copied but not yet visible in Jellyfin: {display_name}")
        notify("Media Drop", f"{display_name} copied to server.", "Jellyfin indexing may still be in progress.")

    # 11. Log entry
    duration = (datetime.now() - job.started).seconds
    log.info(
        f"IMPORT LOG | file={name} | dest={dest} | duration={duration}s "
        f"| jellyfin={'found' if found else 'pending'}"
    )


# ---------------------------------------------------------------------------
# File system watcher
# ---------------------------------------------------------------------------

MEDIA_EXTENSIONS = {
    ".mkv", ".mp4", ".m4v", ".avi", ".mov", ".wmv",
    ".mp3", ".flac", ".aac", ".m4a", ".ogg", ".wav",
    ".jpg", ".jpeg", ".png", ".heic", ".gif",
    ".m4b",  # audiobooks
}

IGNORED_PREFIXES = (".", "~", "._")


def should_process(path: Path) -> bool:
    name = path.name
    if any(name.startswith(p) for p in IGNORED_PREFIXES):
        return False
    if path.suffix.lower() not in MEDIA_EXTENSIONS:
        return False
    return True


class MediaDropHandler(FileSystemEventHandler):
    def __init__(self, import_queue: Queue, drop_root: Path, log: logging.Logger):
        self.queue     = import_queue
        self.drop_root = drop_root
        self.log       = log
        self._seen: set[Path] = set()

    def _get_folder(self, path: Path) -> str | None:
        try:
            rel = path.relative_to(self.drop_root)
            return rel.parts[0] if rel.parts else None
        except ValueError:
            return None

    def on_created(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if not should_process(path):
            return
        folder = self._get_folder(path)
        if not folder or folder in ("Failed",):
            return
        if path in self._seen:
            return
        self._seen.add(path)
        self.log.info(f"Detected: {path.name} in {folder}/")
        self.queue.put(ImportJob(path, folder))

    def on_moved(self, event):
        # Handles files moved/dragged into the folder (not just created)
        if event.is_directory:
            return
        self.on_created(type("E", (), {"is_directory": False, "src_path": event.dest_path})())


# ---------------------------------------------------------------------------
# Import queue worker
# ---------------------------------------------------------------------------

def queue_worker(import_queue: Queue, cfg: dict, jellyfin: JellyfinClient, log: logging.Logger) -> None:
    log.info("Import queue worker started.")
    while True:
        job = import_queue.get()
        try:
            process_import(job, cfg, jellyfin, log)
        except Exception as e:
            log.error(f"Unhandled error processing {job.src_path.name}: {e}", exc_info=True)
        finally:
            import_queue.task_done()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    cfg      = load_config()
    log      = setup_logging(cfg["log_path"])
    drop_root = cfg["media_drop_path"]

    log.info("=" * 60)
    log.info("Media Drop service starting")
    log.info(f"Watching: {drop_root}")
    log.info(f"Server:   {cfg['smb_server']}")
    log.info("=" * 60)

    jellyfin = JellyfinClient(cfg["jellyfin"]["url"], cfg["jellyfin"]["api_key"], log)

    import_queue: Queue = Queue()

    # Start queue worker thread
    worker = Thread(target=queue_worker, args=(import_queue, cfg, jellyfin, log), daemon=True)
    worker.start()

    # Start file system observer
    handler  = MediaDropHandler(import_queue, drop_root, log)
    observer = Observer()
    observer.schedule(handler, str(drop_root), recursive=True)
    observer.start()

    notify("Media Drop", "Service started. Watching for new media.", "")
    log.info("Watching for files. Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Shutting down...")
        observer.stop()
    observer.join()


if __name__ == "__main__":
    main()
