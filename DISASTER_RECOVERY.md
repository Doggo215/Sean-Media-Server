# Disaster Recovery

This document describes how to completely rebuild the Sean Media Server from scratch.

**Target recovery time: under 60 minutes.**

A brand new Raspberry Pi 4, the GitHub repository, and a backup archive are all that is required.

---

## When to Use This Guide

- SD card failure or corruption
- Pi hardware replacement
- Accidental data deletion
- OS reinstall required
- Starting from a completely fresh machine

---

## What Is Recoverable

| Data | Recoverable | Source |
|---|---|---|
| Jellyfin config | ✅ | Backup archive |
| Users and passwords | ✅ | Backup archive |
| Watch history | ✅ | Backup archive |
| Library definitions | ✅ | Backup archive |
| Metadata and artwork | ✅ | Backup archive (or re-scrape) |
| Samba config | ✅ | Backup archive |
| Media Drop service | ✅ | GitHub + backup |
| Media files (movies, TV) | ✅ | External drive or re-rip |
| Home videos / photos | ✅ | Mac backup or external drive |
| System config | ✅ | GitHub + backup |

---

## Prerequisites

Before starting:

- [ ] A Raspberry Pi 4 with a fresh 32GB+ microSD card
- [ ] Raspberry Pi Imager (download from raspberrypi.com)
- [ ] A Mac on the same local network
- [ ] The GitHub repository: `https://github.com/[your-username]/Sean-Media-Server`
- [ ] The most recent backup archive from `~/Backups/MediaServer-Backups/Weekly/`
- [ ] Approximately 60 minutes

---

## Step 1 — Flash Raspberry Pi OS (10 minutes)

1. Open **Raspberry Pi Imager**
2. Choose OS: **Raspberry Pi OS Lite (64-bit)** — Debian Trixie
3. Choose Storage: your microSD card
4. Click the ⚙️ gear icon to configure:
   - Set hostname: `media-server`
   - Enable SSH: ✅
   - Set username: `sean`
   - Set password: *(your Pi password)*
   - Configure WiFi: leave blank (wired only)
5. Click **Write** and wait for completion
6. Insert SD card into Pi, connect Ethernet, power on
7. Wait 90 seconds for first boot

---

## Step 2 — Find the Pi on the Network (5 minutes)

From your Mac:

```bash
# Try hostname first
ping -c 3 media-server.local

# If that fails, check your router admin at http://10.0.0.1
# Look for a device named "media-server" and note its IP
```

Once you have the IP, verify SSH:

```bash
ssh sean@10.0.0.226   # substitute actual IP if different
```

---

## Step 3 — Clone the Repository (2 minutes)

On your Mac:

```bash
cd ~/Desktop
git clone https://github.com/[your-username]/Sean-Media-Server
cd Sean-Media-Server
```

---

## Step 4 — Run the Restore Script (30 minutes)

```bash
bash scripts/restore.sh ~/Backups/MediaServer-Backups/Weekly/media-server-backup-YYYY-MM-DD.tar.gz
```

The restore script will automatically:

1. Install Jellyfin from the official repository
2. Install Samba
3. Restore all Jellyfin configuration (users, libraries, watch history)
4. Restore Samba shares (`media`, `incoming`)
5. Recreate `/srv/media/` directory structure with correct permissions
6. Restore Media Drop service and Launch Agent
7. Restart all services
8. Run a full health check

---

## Step 5 — Manual Verification (10 minutes)

After the restore script completes:

**Jellyfin Web UI**
```
http://10.0.0.226:8096
```
- [ ] Can log in as `doggo`
- [ ] Libraries appear (Movies, TV Shows, etc.)
- [ ] Watch history visible
- [ ] No error messages in Dashboard

**Samba Shares**
```
smb://media-server.local/media
smb://media-server.local/incoming
```
- [ ] Both shares visible in Finder
- [ ] Can create and delete a test file

**Media Drop**
- [ ] `~/Desktop/Media Drop/` folders present
- [ ] `launchctl list | grep mediadrop` shows running PID

**Android TV**
- [ ] Jellyfin app discovers server automatically
- [ ] Libraries visible

---

## Step 6 — Reconnect Media (if drive was wiped)

If the Pi's SD card was replaced and media files are on an external 4TB drive:

```bash
# Reconnect the 4TB drive to the Pi
# It should remount automatically via /etc/fstab

ssh sean@10.0.0.226 "df -h | grep srv"
```

If the drive is not auto-mounted:

```bash
ssh sean@10.0.0.226 "sudo mount -a && df -h | grep srv"
```

Trigger a Jellyfin library scan after mounting:

```
http://10.0.0.226:8096 → Dashboard → Libraries → Scan All Libraries
```

---

## Backup Retention Policy

| Type | Frequency | Retained |
|---|---|---|
| Daily | Every day | 7 days |
| Weekly | Every Sunday | 8 weeks |
| Manual | On demand | Forever (until manually pruned) |

Backups are stored at:
```
~/Backups/MediaServer-Backups/
├── Daily/
├── Weekly/
├── Manual/
└── Restore/     ← put archives here before restoring
```

---

## Recovery Time Estimate

| Step | Time |
|---|---|
| Flash OS | 10 min |
| First boot + SSH | 5 min |
| Clone repository | 2 min |
| Run restore script | 25 min |
| Manual verification | 10 min |
| **Total** | **~52 minutes** |

---

## Emergency Quick Reference

```bash
# Check if server is alive
bash ~/Desktop/Sean-Media-Server/scripts/health-check.sh

# Run a manual backup right now
bash ~/Desktop/Sean-Media-Server/scripts/backup.sh manual

# Verify a backup archive
bash ~/Desktop/Sean-Media-Server/scripts/verify-backup.sh

# Restore from backup
bash ~/Desktop/Sean-Media-Server/scripts/restore.sh \
  ~/Backups/MediaServer-Backups/Weekly/media-server-backup-YYYY-MM-DD.tar.gz

# Check Jellyfin on Pi
ssh sean@10.0.0.226 "systemctl status jellyfin --no-pager | head -5"

# Check Samba on Pi
ssh sean@10.0.0.226 "systemctl is-active smbd nmbd"

# Re-enable Media Drop service
launchctl load ~/Library/LaunchAgents/com.sean.mediadrop.plist
```
