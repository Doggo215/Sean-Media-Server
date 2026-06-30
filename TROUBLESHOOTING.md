# Troubleshooting

---

## Jellyfin Won't Start

```bash
sudo systemctl status jellyfin --no-pager
sudo journalctl -u jellyfin -n 50 --no-pager
```

Common causes: port conflict, disk full, corrupted database.

Check disk space first:
```bash
df -h /
```

---

## Can't Reach Jellyfin from Browser

1. Confirm Jellyfin is running: `systemctl is-active jellyfin`
2. Confirm it's listening: `ss -tlnp | grep 8096`
3. Confirm Pi is reachable: `ping 10.0.0.225` from Mac
4. Try direct IP if hostname doesn't resolve: `http://10.0.0.225:8096`

---

## SSH Connection Refused

1. Confirm Pi is powered on and booted
2. Confirm Ethernet cable is connected
3. Check SSH service: `sudo systemctl status ssh`
4. Verify Pi's IP hasn't changed (check router admin at `10.0.0.1`)

---

## Movie Not Appearing in Jellyfin

1. Verify folder and file naming matches convention in `MEDIA_ORGANIZATION.md`
2. Trigger manual scan: Dashboard → Libraries → (three dots) → Scan
3. Check Jellyfin logs for match errors: `sudo journalctl -u jellyfin -n 100 --no-pager`
4. If no auto-match: add TMDb ID to folder name, e.g. `Elf (2003) [tmdbid-9273]`

---

## Metadata Not Downloading

1. Confirm Pi has internet access: `ping -c 3 8.8.8.8`
2. Check Jellyfin internet access setting: Dashboard → Libraries → (edit) → verify metadata providers are enabled
3. Check logs for TMDb API errors

---

## Android TV Can't Find Server

1. Confirm TV and Pi are on the same network (`10.0.0.x`)
2. Open Jellyfin app → Add Server → manually enter `http://10.0.0.225:8096`
3. Confirm Jellyfin is running and port 8096 is listening

---

## Re-enabling Previous Projects (After Pi 5 Migration)

Panel OS:
```bash
sudo systemctl enable panel-os.service
sudo systemctl start panel-os.service
```

Stadium OS:
```bash
sudo systemctl enable stadium-os.service
sudo systemctl start stadium-os.service
```

---

## Health Check

Quick server health check:
```bash
ssh sean@10.0.0.225 "hostname && systemctl is-active jellyfin && df -h / | tail -1 && free -h | grep Mem && uptime"
```
