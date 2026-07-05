# USB Movie Library — Temporary Setup

This is a **temporary** configuration. Movies are served directly from a USB drive
until a dedicated external media drive is installed.

---

## Current Setup

| | |
|---|---|
| **USB drive** | `/media/sean/Samsung256` (Samsung 256GB exFAT, auto-mounted by udisks2) |
| **Bind mount** | `/srv/media/usb-movies` |
| **Movies in library** | 155 |
| **SD card used for movies** | No — SD card is for OS and metadata only |
| **USB must remain plugged in** | Yes — removing it makes movies unavailable until replugged |

### Jellyfin Movies Library Paths

```
/srv/media/movies        ← permanent home (currently empty, reserved for future drive)
/srv/media/usb-movies    ← USB bind-mount (active movie source)
```

---

## Config Files Changed

| File | Change |
|---|---|
| `/var/lib/jellyfin/root/default/Movies/options.xml` | Added `/srv/media/usb-movies` to `<PathInfos>` |
| `/var/lib/jellyfin/root/default/Movies/samsung256.mblink` | New file — points Jellyfin Locations to `/srv/media/usb-movies` |
| `/etc/fstab` | Bind-mount entry added for persistence across reboots |

### /etc/fstab entry

```
/media/sean/Samsung256  /srv/media/usb-movies  none  bind  0  0
```

### options.xml PathInfos block

```xml
<PathInfos>
  <MediaPathInfo>
    <Path>/srv/media/movies</Path>
  </MediaPathInfo>
  <MediaPathInfo>
    <Path>/srv/media/usb-movies</Path>
  </MediaPathInfo>
</PathInfos>
```

### samsung256.mblink contents

```
/srv/media/usb-movies
```

---

## Future Migration Plan

When a dedicated external media drive is installed:

1. Mount the new drive (e.g., `/srv/media/external`)
2. Copy movies from USB to new drive:
   ```bash
   rsync -av --progress /srv/media/usb-movies/ /srv/media/external/movies/
   ```
3. Copy into the permanent path Jellyfin already knows:
   ```bash
   rsync -av --progress /srv/media/usb-movies/ /srv/media/movies/
   ```
4. Remove the USB path from Jellyfin:
   - Delete `/var/lib/jellyfin/root/default/Movies/samsung256.mblink`
   - Remove the USB `<MediaPathInfo>` block from `options.xml`
5. Remove the fstab bind-mount entry
6. Restart Jellyfin: `sudo systemctl restart jellyfin`
7. Trigger a library scan to confirm all movies are found at the new path
8. Verify no movies are missing, then safely eject the USB

---

## Rebuild / Restore Checklist

If the Pi is rebuilt from scratch, recreate this setup as follows:

```bash
# 1. Plug in the Samsung 256GB USB drive
# 2. Let udisks2 auto-mount it (confirm at /media/sean/Samsung256)

# 3. Create the bind-mount target
sudo mkdir -p /srv/media/usb-movies

# 4. Add bind-mount to fstab
echo "/media/sean/Samsung256  /srv/media/usb-movies  none  bind  0  0" | sudo tee -a /etc/fstab

# 5. Mount it
sudo mount --bind /media/sean/Samsung256 /srv/media/usb-movies

# 6. Create the samsung256.mblink file
printf "/srv/media/usb-movies" | sudo tee /var/lib/jellyfin/root/default/Movies/samsung256.mblink
sudo chown jellyfin:jellyfin /var/lib/jellyfin/root/default/Movies/samsung256.mblink

# 7. Edit /var/lib/jellyfin/root/default/Movies/options.xml
# Add inside <PathInfos>:
#   <MediaPathInfo>
#     <Path>/srv/media/usb-movies</Path>
#   </MediaPathInfo>
sudo chown jellyfin:jellyfin /var/lib/jellyfin/root/default/Movies/options.xml

# 8. Restart Jellyfin
sudo systemctl restart jellyfin

# 9. Trigger a library scan via the API or Jellyfin dashboard
curl -s -X POST "http://localhost:8096/ScheduledTasks/Running/7738148ffcd07979c7ceb148e06b3aed" \
  -H "Authorization: MediaBrowser Token=<API_KEY>"
```

### Verify it worked

```bash
# Check bind-mount is active
mount | grep usb-movies

# Check jellyfin can read it
sudo -u jellyfin ls /srv/media/usb-movies | head -5

# Check movie count via API
curl -s "http://localhost:8096/Items?IncludeItemTypes=Movie&Recursive=true&Limit=1" \
  -H "Authorization: MediaBrowser Token=<API_KEY>" | python3 -m json.tool | grep TotalRecordCount
```

---

## Notes

- The Jellyfin API key for Sean Home is stored in the Pi's Jellyfin SQLite database.
- Jellyfin metadata and thumbnails are stored on the SD card at `/var/lib/jellyfin/`.
- The USB drive is exFAT formatted — Jellyfin cannot write metadata directly to it (read-only scan).
- The `jellyfin` user cannot access `/media/sean/` directly (permission boundary) — the bind-mount to `/srv/media/usb-movies` is required.
