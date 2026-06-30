# Backup

---

## What Is Backed Up

| Data | Location on Pi | Priority |
|---|---|---|
| Jellyfin database | `/var/lib/jellyfin/` | Critical |
| Jellyfin config | `/etc/jellyfin/` | Critical |
| Samba config | `/etc/samba/smb.conf` | Critical |
| System info | hostname, OS, packages | High |
| Service definitions | `/etc/systemd/system/` | High |
| Network config | `/etc/hosts`, `/etc/hostname` | High |
| Media directory tree | `/srv/media/` (structure only, not files) | Medium |
| Media Drop scripts | Mac local copy | High |
| Launch Agent | `~/Library/LaunchAgents/` | High |
| Documentation | All `.md` files | Medium |

**Media files (movies, TV) are not backed up by these scripts.** They are large and assumed recoverable from physical media. Home videos and family photos should have a separate manual backup strategy.

---

## Schedule

| Type | Frequency | Time | Script | Log |
|---|---|---|---|---|
| Nightly | Every night | 2:00 AM | `backup.sh` | `~/Library/Logs/MediaServer/backup.log` |
| Weekly | Every Sunday | 2:00 AM | `weekly-backup.sh` | `~/Library/Logs/MediaServer/weekly-backup.log` |
| Manual | On demand | — | `backup.sh manual` | stdout |

Both jobs are configured in crontab on the Mac. To verify:
```bash
crontab -l | grep "Sean Media Server"
```

---

## Retention Policy

| Type | Retained |
|---|---|
| Daily backups | 7 days |
| Weekly archives | 8 weeks (compressed `.tar.gz` + SHA256 checksum) |
| Manual backups | Until manually pruned |

---

## Locations

```
~/Backups/MediaServer-Backups/
├── Daily/          ← nightly backups (kept 7 days)
├── Weekly/         ← compressed archives (kept 8 weeks)
├── Manual/         ← on-demand backups (kept forever)
└── Restore/        ← put archive here before running restore.sh
```

---

## Scripts

```bash
# Manual backup right now
bash ~/Desktop/Sean-Media-Server/scripts/backup.sh manual

# Weekly archive (compress + checksum + prune)
bash ~/Desktop/Sean-Media-Server/scripts/weekly-backup.sh

# Verify a backup
bash ~/Desktop/Sean-Media-Server/scripts/verify-backup.sh ~/Backups/MediaServer-Backups/Daily/<date>

# Restore from archive
bash ~/Desktop/Sean-Media-Server/scripts/restore.sh ~/Backups/MediaServer-Backups/Weekly/media-server-backup-YYYY-MM-DD.tar.gz
```

---

## Disaster Recovery

See [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) for complete rebuild instructions.

Target recovery time from a brand-new Pi: **under 60 minutes**.
