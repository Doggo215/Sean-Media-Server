# Notes

Working notes and observations. Not permanent documentation.

---

## 2026-06-30

- Pi was previously named `panel-os` — hosted Sean OS Panel OS and Stadium OS projects before repurposing
- Pi 4 has two IP addresses (10.0.0.225 and 10.0.0.226) — likely ethernet + virtual interface; primary is 10.0.0.225
- Jellyfin 10.11.11 API does not accept `photos` as a collection type via REST POST — Family Photos library needs type set via web UI
- The `homevideos` and `photos` library types cause Jellyfin to restart its auth service during creation — require longer waits between API calls
- `sean` is added to the `jellyfin` group but group membership won't take effect until next SSH login session
- Static IP not yet assigned — Pi is DHCP at 10.0.0.225; recommend router DHCP reservation to lock this in
