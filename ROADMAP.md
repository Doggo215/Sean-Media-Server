# Roadmap

---

## Phase 1 — Foundation ✅ Complete

- [x] Inspect existing Pi hardware and OS
- [x] Disable previous Sean OS services (panel-os, stadium-os) — code preserved
- [x] Update all system packages
- [x] Rename hostname to `media-server`
- [x] Reboot and verify persistence
- [x] Install Jellyfin from official repository
- [x] Verify Jellyfin service running and enabled on boot
- [x] Verify web UI loads from browser (`http://10.0.0.225:8096`)
- [x] Complete Jellyfin first-run wizard

---

## Phase 2 — Media Library Foundation ✅ Complete

- [x] Create `/srv/media/` permanent directory structure
- [x] Set correct ownership (`jellyfin:jellyfin`) and permissions
- [x] Add `sean` to `jellyfin` group for file transfer access
- [x] Create all 10 Jellyfin libraries pointing to correct paths
- [ ] Verify Family Photos library type in web UI (minor — API limitation)

---

## Phase 3 — First Import and Verification ✅ Complete

- [ ] Transfer first movies to staging
- [ ] Verify file integrity in staging
- [ ] Move files into permanent library structure
- [ ] Trigger Jellyfin library scan
- [ ] Verify metadata downloads automatically
- [ ] Verify poster artwork downloads
- [ ] Verify movies appear in library
- [ ] Verify browser playback
- [ ] Verify Android TV playback
- [ ] Document permanent import workflow

---

## Phase 3B — SMB File Sharing ✅ Complete

- [x] Samba installed and configured
- [x] `media` share → `/srv/media`
- [x] `incoming` share → `/srv/media/staging`
- [x] macOS Finder connectivity verified
- [x] Read/write permissions verified for `sean` and `jellyfin`

## Phase 3C — Media Drop Automation ✅ Complete

- [x] `~/Desktop/Media Drop/` folder structure created
- [x] Python watcher service (`media_drop.py`) written and running
- [x] macOS Launch Agent installed — starts on login
- [x] Full pipeline tested: detect → stabilize → copy → scan → notify
- [x] Duplicate detection implemented
- [x] Failed file routing implemented (`Media Drop/Failed/`)
- [x] macOS notifications working
- [x] Structured import log at `~/Library/Logs/MediaDrop/media_drop.log`
- [x] Permanent Jellyfin API key generated for service

## Phase 3D — Optimization

- [ ] Enable hardware acceleration (V4L2 on Pi 4)
- [ ] Performance tuning
- [ ] Automatic library scanning configuration
- [ ] Transcoding verification

---

## Phase 4 — Storage Expansion

- [ ] Install 4TB USB hard drive
- [ ] Format with appropriate filesystem (ext4)
- [ ] Mount permanently at `/srv/media/` (or migrate to new mount)
- [ ] Migrate all media from SD card to 4TB drive
- [ ] Update Jellyfin library paths
- [ ] Verify all metadata, artwork, and watch history preserved
- [ ] Verify all users preserved
- [ ] No library rebuild required

---

## Phase 5 — Backup Strategy

- [ ] Define backup targets (config, metadata, library database)
- [ ] Automate Jellyfin config backup
- [ ] Automate metadata backup
- [ ] Verify restore procedure
- [ ] Document disaster recovery

---

## Phase 6 — Sean OS Integration

Only after the Media Server is fully complete and stable.

- [ ] Expose Jellyfin API to Sean OS (Pi 5)
- [ ] Movie Mode lighting automation
- [ ] Playback notifications
- [ ] Now Playing display (Tidbyt / LED panels)
- [ ] Voice command integration (future Jarvis)
- [ ] Presence detection — auto-dim lights on playback
- [ ] Automatic TV control via LG API
- [ ] Ambient room effects based on content

**Rule:** Jellyfin must never depend on Sean OS. If Sean OS is offline, the Media Server operates normally. Sean OS enhances — it does not replace.

---

## Permanent Backlog

- Remote access / secure tunnel (future, only on request)
- Multi-user profiles
- Parental controls
- Custom metadata for home videos
- Smart playlists
- Live TV integration (future)
