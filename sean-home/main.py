"""
Sean Home v1.0 — FastAPI backend
Runs on port 8088 alongside Jellyfin (8096).
Phase 1A: scaffold, health, system status, static serving.
"""

import time
import shutil
import subprocess
from datetime import datetime
from zoneinfo import ZoneInfo

import psutil
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

DENVER = ZoneInfo("America/Denver")
START_TIME = time.time()

app = FastAPI(title="Sean Home", version="1.0.0")
app.mount("/static", StaticFiles(directory="/home/sean/sean-home/static"), name="static")
templates = Jinja2Templates(directory="/home/sean/sean-home/templates")


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "sean-home", "version": "1.0.0"}


# ─── System status ───────────────────────────────────────────────────────────

@app.get("/api/system")
def system_status():
    now = datetime.now(DENVER)
    uptime_seconds = int(time.time() - psutil.boot_time())

    # Disk — root filesystem
    disk = shutil.disk_usage("/")
    disk_pct = round(disk.used / disk.total * 100, 1)
    disk_free_gb = round(disk.free / 1024**3, 1)

    # Disk — /srv/media if mounted
    try:
        media_disk = shutil.disk_usage("/srv/media")
        media_pct = round(media_disk.used / media_disk.total * 100, 1)
        media_free_gb = round(media_disk.free / 1024**3, 1)
    except FileNotFoundError:
        media_pct = None
        media_free_gb = None

    # RAM
    ram = psutil.virtual_memory()
    ram_pct = ram.percent
    ram_available_mb = round(ram.available / 1024**2)

    # CPU temp (Pi-specific)
    try:
        result = subprocess.run(
            ["vcgencmd", "measure_temp"],
            capture_output=True, text=True, timeout=3
        )
        temp_str = result.stdout.strip()  # "temp=42.8'C"
        cpu_temp = float(temp_str.split("=")[1].replace("'C", ""))
    except Exception:
        cpu_temp = None

    # CPU usage (1-second sample)
    cpu_pct = psutil.cpu_percent(interval=1)

    return {
        "timestamp": now.isoformat(),
        "uptime_seconds": uptime_seconds,
        "disk": {
            "root_pct": disk_pct,
            "root_free_gb": disk_free_gb,
            "media_pct": media_pct,
            "media_free_gb": media_free_gb,
        },
        "ram": {
            "used_pct": ram_pct,
            "available_mb": ram_available_mb,
        },
        "cpu": {
            "used_pct": cpu_pct,
            "temp_c": cpu_temp,
        },
    }


# ─── Dashboard ───────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    now = datetime.now(DENVER)
    return templates.TemplateResponse("index.html", {
        "request": request,
        "time": now.strftime("%-I:%M %p"),
        "date": now.strftime("%A, %B %-d, %Y"),
    })
