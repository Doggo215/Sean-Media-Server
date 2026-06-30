# Sean Home v1.0 — Project Proposal

**Date:** June 30, 2026
**Status:** Proposed
**Host:** Raspberry Pi 4 — `media-server` (10.0.0.226)

---

## What It Is

Sean Home is a lightweight, TV-friendly web dashboard that runs as a separate service alongside Jellyfin on the Pi 4. It surfaces media status, server health, weather, and quick links to Jellyfin libraries — all on one screen, readable from a couch.

It does not modify Jellyfin. It reads from Jellyfin's existing REST API using the permanent API key already in use by Media Drop.

---

## Why the Pi 4

The Pi 4 is already always-on, always-connected, and running Jellyfin. Adding a lightweight web server alongside it requires minimal resources and keeps the dashboard co-located with the data it displays. No new hardware needed for Phase 1.

---

## Architecture

```
Browser / TV / Phone
        ↓  http://10.0.0.226:8097
  Sean Home (Python + FastAPI)
        ↓ reads from
  Jellyfin REST API (port 8096)      ← existing, no changes
  Open-Meteo Weather API             ← free, no API key required
  Pi system metrics (local)          ← disk, CPU, RAM, temp
```

Sean Home is a read-only consumer of Jellyfin. It never writes to or modifies Jellyfin configuration.

**Port:** 8097 (Jellyfin occupies 8096 — no conflict)
**Framework:** Python FastAPI + Jinja2 templates
**Frontend:** Plain HTML/CSS/JavaScript — no build step, no Node.js
**Auto-refresh:** Page refreshes every 60 seconds via meta tag or lightweight JS

---

## Phase 1 Features

### 1. Current Time
- Large digital clock in the header
- Timezone: America/Denver (Arvada, CO)

### 2. Weather — Arvada, CO
- Source: [Open-Meteo](https://open-meteo.com/) — free, no API key, no rate limits
- Latitude: 39.8028 / Longitude: −105.0875
- Display: current temperature (°F), condition (sunny / cloudy / rain / snow), high/low for today

### 3. Jellyfin Status
- Online / Offline indicator
- Jellyfin version
- Number of active streams (if any)
- Source: `GET /System/Info` and `GET /Sessions`

### 4. Recently Added Media
- Last 10 items added to any library
- Shows: title, library (Movies / TV / etc.), date added, poster thumbnail
- Source: `GET /Items?SortBy=DateCreated&SortOrder=Descending&Limit=10`

### 5. Continue Watching
- Items in progress for the default user
- Shows: title, progress percentage, resume button (links directly to Jellyfin player)
- Source: `GET /Items?Filters=IsResumable`

### 6. Media Server Health Summary
- Disk usage (`/srv/media/` and `/`)
- CPU temperature
- RAM usage
- Jellyfin service status
- Source: Pi system metrics via SSH or local `psutil` if Sean Home runs on the Pi directly

### 7. Library Quick-Launch Buttons
- One large button per Jellyfin library
- Libraries: Movies, TV Shows, Kids, Documentaries, Sports, Home Videos, Family Photos, Christmas, Music, Audiobooks
- Each button links directly to that library in the Jellyfin web UI
- Designed to be finger/remote-friendly — minimum 120px tall, high contrast

---

## Design Direction

- **TV-first** — legible at 10 feet on a 65-inch screen
- **Dark background** — reduces glare on TV panels
- **Large type** — minimum 20px body, 48px+ for clock and key stats
- **No scrolling on a TV** — everything on one screen at 1080p
- **Responsive** — scales down to phone/tablet without breaking
- **No login required** — local network only, no authentication

---

## Future Expansion (Not Phase 1)

These are intentionally excluded from Phase 1 but the architecture accommodates them:

| Feature | Source |
|---|---|
| Sports scores / schedules | Pi 5 / Sean OS event bus |
| Room presence (Sean entered / left) | Pi 5 FP2 sensor |
| Govee light scene status | Pi 5 |
| Now playing on Sonos | Pi 5 |
| Tidbyt current display | Pi 5 |
| TV on/off status | Pi 5 LG TV integration |
| Milo mood / personality display | Pi 5 |

When Sean OS on the Pi 5 is stable, Sean Home can add a `/api/seanos` data feed from the Pi 5 alongside the existing Jellyfin feed — no rearchitecting required.

---

## File Structure

```
Sean-Media-Server/
└── sean-home/
    ├── main.py                 ← FastAPI app, routes, data fetching
    ├── templates/
    │   └── index.html          ← Jinja2 template, all UI
    ├── static/
    │   ├── style.css           ← TV-friendly styles
    │   └── dashboard.js        ← auto-refresh, clock update
    ├── requirements.txt        ← fastapi, uvicorn, httpx, psutil
    └── install.sh              ← systemd service setup
```

Deployed as a systemd service: `sean-home.service`
Auto-starts on boot alongside `jellyfin.service`.

---

## Implementation Plan

| Phase | Task |
|---|---|
| 1A | Scaffold FastAPI app, verify it runs on Pi 4 port 8097 |
| 1B | Clock + weather widget (Open-Meteo) |
| 1C | Jellyfin status + recently added + continue watching |
| 1D | Health summary (disk / CPU / RAM / temp) |
| 1E | Library quick-launch buttons |
| 1F | TV-friendly CSS pass — test on actual TV |
| 1G | systemd service + health-check.sh integration |
| 1H | Document, commit, tag `SEAN_HOME_v1.0` |

---

## Success Criteria

- [ ] Dashboard loads at `http://10.0.0.226:8097` from any device on the network
- [ ] All 7 Phase 1 widgets display correct live data
- [ ] Jellyfin is not modified — zero changes to its config, database, or web UI
- [ ] Dashboard is legible on a TV at normal viewing distance
- [ ] Service starts automatically on Pi boot
- [ ] `health-check.sh` updated to verify Sean Home is running
- [ ] Jellyfin continues to function normally with Sean Home running alongside it

---

## What This Is Not

- Not a Jellyfin plugin or modification
- Not a replacement for the Jellyfin web UI
- Not connected to Pi 5 or Sean OS in Phase 1
- Not exposed to the internet
- Not a media player — all playback still happens in Jellyfin
