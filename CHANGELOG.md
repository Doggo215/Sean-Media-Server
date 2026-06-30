# Changelog

---

## [0.2.0] — 2026-06-30

### Added
- `/srv/media/` permanent directory structure (13 directories)
- 10 Jellyfin libraries: Movies, TV Shows, Kids, Documentaries, Sports, Home Videos, Family Photos, Christmas, Music, Audiobooks
- `sean` user added to `jellyfin` group for direct file access

### Notes
- Family Photos library type must be verified via Jellyfin web UI (API limitation in 10.11.11)

---

## [0.1.0] — 2026-06-30

### Added
- Jellyfin 10.11.11 installed from official Debian repository
- Jellyfin service enabled and running on boot
- Web UI confirmed accessible at `http://10.0.0.226:8096`
- Official Jellyfin apt repository configured

### Changed
- Hostname renamed from `panel-os` to `media-server`
- 18 OS packages updated (including libssh2 security patch)

### Preserved (Not Changed)
- `/home/sean/panel-os/` — Panel OS code intact
- `/home/sean/stadium-os/` — Stadium OS code intact
- `panel-os.service` and `stadium-os.service` — disabled but not removed

---

## [0.0.1] — 2026-06-30

### Baseline
- Pi 4 inspected: Debian 13 Trixie, kernel 6.18.34, 49GB free
- SSH confirmed working as `sean`
- Previous services (panel-os, stadium-os) found running — disabled for repurposing

---

## [0.3.0] — 2026-06-30

### Added
- Samba 4.22.8 installed for local network file sharing
- Two authenticated SMB shares configured:
  - `media` → `/srv/media` (full library, read/write)
  - `incoming` → `/srv/media/staging` (drop zone for new media)
- macOS Finder compatibility via `vfs objects = fruit streams_xattr`
- Samba user `sean` configured with authenticated access
- `smbd` and `nmbd` services enabled on boot

### Changed
- `/srv/media` permissions updated from `755` to `775` (group-writable)
- All subdirectories now `775 jellyfin:jellyfin`
- Files created via Samba inherit `jellyfin` group via `force group`

### Permission Model
- `sean` — full read/write via Samba and SSH
- `jellyfin` — owner of all media directories
- Files created via Samba: `0664 sean:jellyfin`
- Directories created via Samba: `0775 sean:jellyfin`
- Jellyfin can read and write all content
