# Sean Media Server

**Version:** 1.0
**Status:** Production Ready | Stable | Backed Up | Recoverable
**Date:** June 30, 2026

---

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
| IP Address | `10.0.0.225` (DHCP reserved) |
| OS | Debian GNU/Linux 13 (Trixie) |
| Jellyfin | 10.11.11 |
| Web UI | http://10.0.0.225:8096 |
| SSH | `ssh sean@10.0.0.225` |
| Media Root | `/srv/media/` |
| GitHub | https://github.com/Doggo215/Sean-Media-Server |

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
| [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) | Complete rebuild guide — target 52 minutes |
| [PRIVACY_AND_SAFE_DOWNLOADS.md](PRIVACY_AND_SAFE_DOWNLOADS.md) | Browser setup, safe downloads, VPN, DNS, import workflow |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Known issues and solutions |
| [NOTES.md](NOTES.md) | Scratch pad and working notes |
| [TODO.md](TODO.md) | Outstanding tasks |

---

## Scripts

| Script | Purpose | Schedule |
|---|---|---|
| `scripts/backup.sh` | Backup Jellyfin config, Samba, system | Nightly 2:00 AM |
| `scripts/weekly-backup.sh` | Compressed archive + checksum + prune | Sunday 2:00 AM |
| `scripts/verify-backup.sh` | Verify backup integrity | On demand |
| `scripts/health-check.sh` | 19-point health report | On demand |
| `scripts/restore.sh` | Full restore from backup archive | On demand |
| `scripts/install.sh` | Full server installation from scratch | On demand |
| `scripts/update.sh` | System and Jellyfin updates | On demand |

---

## Backup

| Type | Frequency | Retained | Location |
|---|---|---|---|
| Daily | Every night at 2:00 AM | 7 days | `~/Backups/MediaServer-Backups/Daily/` |
| Weekly | Every Sunday at 2:00 AM | 8 weeks | `~/Backups/MediaServer-Backups/Weekly/` |
| Manual | On demand | Until pruned | `~/Backups/MediaServer-Backups/Manual/` |

---

## Network

The Pi's IP address `10.0.0.225` is reserved via DHCP at the router (10.0.0.1).
The IP is not hardcoded on the Pi — networking is centrally managed by the router.

To update the reservation: log into http://10.0.0.1 → DHCP → Static Leases → `media-server`.

---

## Emergency

```bash
# Health check
bash ~/Desktop/Sean-Media-Server/scripts/health-check.sh

# Manual backup
bash ~/Desktop/Sean-Media-Server/scripts/backup.sh manual

# Verify backup
bash ~/Desktop/Sean-Media-Server/scripts/verify-backup.sh ~/Backups/MediaServer-Backups/Daily/<date>

# Check Jellyfin
ssh sean@10.0.0.225 "systemctl status jellyfin --no-pager | head -5"
```

---

## Current Status

Phase 1 (Foundation) — Complete
Phase 2 (Media Library) — Complete
Phase 3 (Import + Samba + Media Drop + Backup) — Complete

**v1.0 — Production Ready**

---

## Project Status

**Version:** 1.0
**Status:** Production Ready
**Current Phase:** Operational

**Development Policy:**
Feature development paused while the server is used in everyday operation.

**Focus:**
- Normal media usage
- Library expansion
- Reliability monitoring
- Bug fixes only
- Documentation updates

**Future major development:**
Sean OS integration (planned)
