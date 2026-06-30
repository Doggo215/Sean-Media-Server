# Storage

---

## Current Storage

| Device | Size | Used | Available | Mount |
|---|---|---|---|---|
| microSD (`/dev/mmcblk0p2`) | 58GB | 7.5GB | 49GB | `/` |
| microSD boot (`/dev/mmcblk0p1`) | 505MB | 87MB | 418MB | `/boot/firmware` |

The microSD card currently hosts the OS, Jellyfin, and the media directory structure.
It is temporary storage for media until the 4TB USB drive arrives.

---

## Media Root

```
/srv/media/
```

All media is stored under this path. This path is permanent and will not change during the 4TB migration.

### Directory Structure

```
/srv/media/
├── movies/          755  jellyfin:jellyfin  — Movie library
├── tv/              755  jellyfin:jellyfin  — TV show library
├── kids/            755  jellyfin:jellyfin  — Kids content
├── documentaries/   755  jellyfin:jellyfin  — Documentaries
├── sports/          755  jellyfin:jellyfin  — Sports content
├── home-videos/     755  jellyfin:jellyfin  — Family home videos
├── family-photos/   755  jellyfin:jellyfin  — Family photos
├── christmas/       755  jellyfin:jellyfin  — Christmas content
├── music/           755  jellyfin:jellyfin  — Music library
├── audiobooks/      755  jellyfin:jellyfin  — Audiobooks
├── metadata/        755  jellyfin:jellyfin  — Metadata overrides
├── downloads/       775  jellyfin:jellyfin  — Active downloads
└── staging/         775  jellyfin:jellyfin  — Import staging
```

### Permission Notes

- `755` — Jellyfin owns, others can read and traverse
- `775` — Group-writable for `downloads/` and `staging/` (automation-friendly)
- User `sean` is a member of the `jellyfin` group

---

## Planned: 4TB USB Hard Drive

### Migration Plan (Zero-Rebuild)

The migration is designed so that Jellyfin library paths never change.

```
Step 1 — Connect 4TB USB drive to Pi
Step 2 — Format drive: mkfs.ext4 /dev/sda1
Step 3 — Temporarily mount: mount /dev/sda1 /mnt/media-drive
Step 4 — Copy all media: rsync -av /srv/media/ /mnt/media-drive/
Step 5 — Verify checksums on critical files
Step 6 — Stop Jellyfin: sudo systemctl stop jellyfin
Step 7 — Unmount /srv/media (if bound) and remount 4TB at /srv/media
Step 8 — Add to /etc/fstab for permanent mount on boot
Step 9 — Start Jellyfin: sudo systemctl start jellyfin
Step 10 — Verify all libraries, metadata, artwork, watch history intact
Step 11 — Verify playback on all clients
```

**Result:** Jellyfin sees the same paths. No library reconfiguration. No metadata rebuild. No watch history loss.

### Recommended Filesystem

`ext4` — standard Linux filesystem, excellent for large media libraries, well-supported, reliable.

Do not use exFAT or NTFS — poor performance and compatibility on Linux servers.

---

## Jellyfin Data Locations

| Data | Path |
|---|---|
| Configuration | `/etc/jellyfin/` |
| Library database | `/var/lib/jellyfin/` |
| Logs | `/var/log/jellyfin/` |
| Transcoding cache | `/var/cache/jellyfin/` |

These paths are on the microSD card and should be included in backups. They do not move during the media storage migration.
