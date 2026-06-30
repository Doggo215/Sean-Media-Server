# Architecture

---

## System Overview

```
Local Network (10.0.0.x)
│
├── Raspberry Pi 4 — media-server (10.0.0.226)
│   └── Jellyfin Media Server (port 8096)
│       └── /srv/media/ (movies, tv, music, etc.)
│
├── Raspberry Pi 5 — Sean OS
│   ├── Govee Lighting Control
│   ├── LG TV Control
│   ├── Tidbyt Display
│   ├── Stadium OS / LED Panels
│   ├── Sonos Integration
│   ├── FP2 Presence Detection
│   └── Future: Jellyfin integration (Movie Mode, lighting, voice)
│
├── Android TV (Living Room)
│   └── Jellyfin Android TV app
│
├── Android TV (Bedroom)
│   └── Jellyfin Android TV app
│
└── Mac (seandolan) — 10.0.0.237
    └── Jellyfin Web UI / SCP file transfers
```

---

## Raspberry Pi 4 — Media Server

| Item | Value |
|---|---|
| Model | Raspberry Pi 4 Model B Rev 1.5 |
| OS | Debian GNU/Linux 13 (Trixie) |
| Kernel | 6.18.34+rpt-rpi-v8 |
| RAM | 1.8GB |
| Storage (boot) | 64GB microSD |
| Storage (future) | 4TB USB hard drive |
| Network | Wired Ethernet (preferred) |
| IP | 10.0.0.226 (DHCP — static IP pending) |
| Hostname | media-server |
| SSH | `ssh sean@10.0.0.226` |

---

## Jellyfin

| Item | Value |
|---|---|
| Version | 10.11.11 |
| Port | 8096 (HTTP, local only) |
| Web UI | http://10.0.0.226:8096 |
| Admin user | doggo |
| Service | `jellyfin.service` (systemd, enabled) |
| Config | `/etc/jellyfin/` |
| Data | `/var/lib/jellyfin/` |
| Logs | `/var/log/jellyfin/` |
| Media root | `/srv/media/` |

---

## Media Storage Layout

```
/srv/media/
├── movies/          Primary movie library
├── tv/              Television series
├── kids/            Kids content (movies + shows)
├── documentaries/   Documentary films
├── sports/          Sports content
├── home-videos/     Family home videos
├── family-photos/   Family photo library
├── christmas/       Christmas content
├── music/           Music library
├── audiobooks/      Audiobook library
├── metadata/        Reserved for metadata overrides
├── downloads/       Active download landing zone (group-writable)
└── staging/         Import staging area (group-writable)
```

All directories owned by `jellyfin:jellyfin`.
User `sean` is a member of the `jellyfin` group for direct file access.

---

## Future Storage Migration Plan

When the 4TB USB drive arrives:

1. Format drive as ext4
2. Mount at `/mnt/media-drive` initially
3. Copy all `/srv/media/` contents to the new drive
4. Verify integrity
5. Unmount and remount the drive at `/srv/media/`
6. Update `/etc/fstab` for permanent mount
7. Restart Jellyfin — no library path changes required
8. Verify all metadata, artwork, and watch history intact

The `/srv/media/` path never changes. Jellyfin never needs reconfiguration.

---

## Sean OS Integration (Future — Phase 6)

Sean OS (Pi 5) will communicate with Jellyfin via the Jellyfin HTTP API.

**Sean OS may:**
- Query now-playing status
- Launch specific movies or shows
- React to playback events (lighting, LED panels, ambient effects)
- Display now-playing on Tidbyt or LED panels
- Send voice commands via future Jarvis integration

**Sean OS must never:**
- Replace or depend on Jellyfin
- Control Jellyfin in a way that breaks local-only operation
- Be a required component for any Jellyfin functionality

**Jellyfin must always:**
- Operate fully if Sean OS is offline
- Be controllable directly from any client without Sean OS

---

## Preserved Previous Projects

These projects lived on this Pi before it became the Media Server.
Code is fully preserved — only autostart was disabled.

| Project | Directory | Re-enable command |
|---|---|---|
| Panel OS | `/home/sean/panel-os/` | `sudo systemctl enable panel-os && sudo systemctl start panel-os` |
| Stadium OS | `/home/sean/stadium-os/` | `sudo systemctl enable stadium-os && sudo systemctl start stadium-os` |

These projects are intended to migrate to the Pi 5 (Sean OS).
