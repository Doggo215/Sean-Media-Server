# Backup

---

## What Must Be Backed Up

| Data | Location | Priority |
|---|---|---|
| Jellyfin database | `/var/lib/jellyfin/` | Critical |
| Jellyfin config | `/etc/jellyfin/` | Critical |
| Jellyfin logs | `/var/log/jellyfin/` | Low |
| Media files | `/srv/media/` | Critical (irreplaceable for home videos/photos) |
| Service files | `/etc/systemd/system/` | Medium |
| SSH keys | `/home/sean/.ssh/` | Medium |

Media files (movies, TV) can be re-ripped from physical media if lost. Home videos and family photos cannot be replaced — treat them as highest priority.

---

## Backup Strategy (To Be Implemented — Phase 5)

### Jellyfin Config + Database

Back up `/var/lib/jellyfin/` and `/etc/jellyfin/` to:
- External USB drive (when 4TB drive is connected)
- Periodic SCP transfer to Mac
- Future: NAS or cloud backup

### Media Files

Home videos and family photos should eventually have a second copy:
- Option A: Second external USB drive
- Option B: NAS with RAID
- Option C: Cloud backup (Backblaze B2 — low cost, large storage)

### Frequency

| Backup Type | Recommended Frequency |
|---|---|
| Jellyfin config + database | Weekly |
| Home videos / family photos | After each new import |
| Full system image | After major changes |

---

## Manual Backup Commands (Temporary — Until Automation)

### Back up Jellyfin data to Mac

```bash
# From Mac
rsync -av sean@10.0.0.225:/var/lib/jellyfin/ ~/Backups/jellyfin-data/
rsync -av sean@10.0.0.225:/etc/jellyfin/ ~/Backups/jellyfin-config/
```

### Back up home videos to Mac

```bash
rsync -av sean@10.0.0.225:/srv/media/home-videos/ ~/Backups/home-videos/
rsync -av sean@10.0.0.225:/srv/media/family-photos/ ~/Backups/family-photos/
```

---

## Restore Procedure

Documented in `scripts/restore.sh` (to be written in Phase 5).

Key principle: restoring Jellyfin config + database to a fresh Jellyfin install on the same media paths should recover all libraries, metadata, artwork, users, and watch history without any manual re-import.
