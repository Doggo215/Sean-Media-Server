# Sean Media Server

A dedicated Raspberry Pi 4 home media server running Jellyfin.

## Purpose

This server is responsible for streaming movies, TV shows, music, audiobooks, home videos, and family photos to any device on the local network — including Android TVs, browsers, and phones.

This server is **not** responsible for AI, automation, LED panels, sports displays, lighting, projector control, voice assistants, or Sean OS. Those responsibilities belong to the Raspberry Pi 5.

The Media Server must remain fully functional even if Sean OS is offline.

---

## Quick Reference

| Item | Value |
|---|---|
| Hostname | `media-server` |
| IP Address | `10.0.0.225` |
| OS | Debian GNU/Linux 13 (Trixie) |
| Jellyfin | 10.11.11 |
| Web UI | http://10.0.0.225:8096 |
| SSH | `ssh sean@10.0.0.225` |
| Media Root | `/srv/media/` |

---

## Hardware

- Raspberry Pi 4 Model B Rev 1.5
- 64GB microSD (boot + OS + Jellyfin)
- Ethernet (wired, preferred)
- Future: 4TB USB hard drive for media storage

---

## Documentation

| File | Contents |
|---|---|
| [PROJECT_CONSTITUTION.md](PROJECT_CONSTITUTION.md) | Mission, philosophy, mandatory rules |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture and Sean OS integration |
| [ROADMAP.md](ROADMAP.md) | Development phases and status |
| [BUILD_LOG.md](BUILD_LOG.md) | Chronological record of every change |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [NETWORK.md](NETWORK.md) | Networking, IP, hostname, static address |
| [STORAGE.md](STORAGE.md) | Directory structure and storage planning |
| [MEDIA_ORGANIZATION.md](MEDIA_ORGANIZATION.md) | Permanent naming and import rules |
| [HARDWARE.md](HARDWARE.md) | Hardware specifications |
| [SOFTWARE.md](SOFTWARE.md) | Installed packages and services |
| [BACKUP.md](BACKUP.md) | Backup procedures and recovery |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Known issues and solutions |
| [NOTES.md](NOTES.md) | Scratch pad and working notes |
| [TODO.md](TODO.md) | Outstanding tasks |

---

## Scripts

| Script | Purpose |
|---|---|
| `scripts/install.sh` | Full server installation from scratch |
| `scripts/update.sh` | System and Jellyfin updates |
| `scripts/backup.sh` | Backup Jellyfin config and metadata |
| `scripts/restore.sh` | Restore from backup |
| `scripts/health-check.sh` | Verify server health |

---

## Current Status

Phase 1 (Foundation) — Complete
Phase 2 (Media Library) — Complete
Phase 3 (First Import + Optimization) — In Progress
