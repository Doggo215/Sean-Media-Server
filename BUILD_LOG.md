# Build Log

Chronological record of every change made to the Media Server.

---

## 2026-06-30 — Session 1: Foundation + Phase 1 + Phase 2

### Infrastructure Inspection

- Pi 4 located at `10.0.0.226` (hostname was `panel-os`)
- OS confirmed: Debian GNU/Linux 13 (Trixie), kernel 6.18.34
- Pi was previously running Panel OS and Stadium OS (Sean OS projects)
- SSH confirmed working as user `sean`
- System healthy: 49GB free, 1.8GB RAM, temp 50°C

### Services Disabled (Previous Projects Preserved)

Stopped and disabled two Sean OS services — code left intact on disk:

| Service | Was running | Working directory | Status |
|---|---|---|---|
| `panel-os.service` | uvicorn API on port 8000 | `/home/sean/panel-os/` | Disabled, code preserved |
| `stadium-os.service` | Node.js server | `/home/sean/stadium-os/` | Disabled, code preserved |

To re-enable on Pi 5 later:
```bash
sudo systemctl enable panel-os.service && sudo systemctl start panel-os.service
sudo systemctl enable stadium-os.service && sudo systemctl start stadium-os.service
```

### OS Update

Updated 18 packages:
- Chromium 149.0.7827.196
- Firefox 152.0.3
- libssh2-1t64 1.11.1-1+deb13u1 (security patch)
- raspi-utils 20260626
- GPIO/firmware libraries 20260626

No kernel update. No reboot required.

### Hostname Change

Changed hostname from `panel-os` to `media-server`:
- `/etc/hostname` updated via `hostnamectl set-hostname media-server`
- `/etc/hosts` updated: `panel-os` → `media-server`
- `/etc/cloud/templates/hosts.debian.tmpl` updated
- Rebooted to verify persistence — confirmed

### Post-Reboot Verification

- SSH reconnected successfully
- Hostname: `media-server`
- `panel-os.service`: disabled / inactive
- `stadium-os.service`: disabled / inactive
- Code directories: fully intact
- Disk: 49GB free

### Jellyfin Installation

Added official Jellyfin repository for Debian Trixie:
- GPG key: `/usr/share/keyrings/jellyfin.gpg`
- Repo: `/etc/apt/sources.list.d/jellyfin.list`

Installed packages:

| Package | Version |
|---|---|
| jellyfin | 10.11.11+deb13 |
| jellyfin-server | 10.11.11+deb13 |
| jellyfin-web | 10.11.11+deb13 |
| jellyfin-ffmpeg7 | 7.1.4-3-trixie |
| libjemalloc2 | 5.3.0-3 |

Jellyfin service: enabled and running on boot.
Web UI: HTTP 200 at `http://10.0.0.226:8096` — confirmed from Mac.

### Media Directory Structure

Created `/srv/media/` as permanent media root:

```
/srv/media/
├── movies/          755  jellyfin:jellyfin
├── tv/              755  jellyfin:jellyfin
├── kids/            755  jellyfin:jellyfin
├── documentaries/   755  jellyfin:jellyfin
├── sports/          755  jellyfin:jellyfin
├── home-videos/     755  jellyfin:jellyfin
├── family-photos/   755  jellyfin:jellyfin
├── christmas/       755  jellyfin:jellyfin
├── music/           755  jellyfin:jellyfin
├── audiobooks/      755  jellyfin:jellyfin
├── metadata/        755  jellyfin:jellyfin
├── downloads/       775  jellyfin:jellyfin
└── staging/         775  jellyfin:jellyfin
```

User `sean` added to `jellyfin` group for direct file transfer access.

### Jellyfin Libraries Created

| Library | Type | Path |
|---|---|---|
| Movies | movies | /srv/media/movies |
| TV Shows | tvshows | /srv/media/tv |
| Kids | mixed | /srv/media/kids |
| Documentaries | movies | /srv/media/documentaries |
| Sports | movies | /srv/media/sports |
| Home Videos | homevideos | /srv/media/home-videos |
| Family Photos | photos | /srv/media/family-photos |
| Christmas | mixed | /srv/media/christmas |
| Music | music | /srv/media/music |
| Audiobooks | books | /srv/media/audiobooks |

Note: Family Photos collection type must be verified via Dashboard → Libraries in the web UI (Jellyfin 10.11.11 API does not accept `photos` type via REST).

---

*Entries above this line represent completed, verified work.*
