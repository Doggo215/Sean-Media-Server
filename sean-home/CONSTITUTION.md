# Sean Home v1.0 — Project Constitution

Sean Media Server v1.0 is now considered complete and operational.

Sean Home is a new project that will run on the Raspberry Pi 4 alongside Jellyfin.

Its purpose is to become the default home screen for my TVs whenever I am not actively watching media.

Sean Home is **not** part of Jellyfin.

Sean Home is **not** part of Sean OS.

Sean Home is its own lightweight web application that presents information from the Media Server and other approved data sources.

---

## Project Goals

Create a beautiful, TV-friendly dashboard that is always available.

It should launch quickly, update automatically, and require almost no maintenance.

It should become the "front door" to my entertainment system.

---

## Design Philosophy

The dashboard should feel modern, clean, and premium.

Think: Apple TV. Google TV. PlayStation. ESPN.

- No clutter
- Large text — readable from across the room
- Simple navigation
- Dark mode by default

---

## Phase 1 Scope

Build the dashboard only.

| Not in Phase 1 |
|---|
| Sean OS integration |
| Voice control |
| Lighting automation |
| Jellyfin modifications |

The dashboard consumes data from existing services only. All data sources must be stable, documented APIs.

---

## Dashboard Modules

### Header
- Current time
- Current date
- Weather — current temperature, today's high/low, weather icon
- Location: Arvada, CO

---

### Jellyfin
- Server online / offline status
- Recently added media
- Continue Watching
- Library statistics
- Storage usage

---

### Sports
- Current Phillies game status or next game
- Current Eagles season information
- Current World Cup status (when active)
- Upcoming favorite team games
- Live scores when a game is in progress

---

### Calendar
- Today's events
- Upcoming appointments
- Birthdays
- Family reminders

---

### PlayStation

Research the best supported method for displaying PlayStation information.

If reliable official APIs exist, display:
- Friends currently online and what they are playing
- My current status
- Recently earned trophies

If no reliable official API exists, document the limitation and recommend the safest supported alternative.

**Do not scrape PlayStation Network. Do not rely on unsupported or undocumented methods.**

---

### Colorado Kids Guide
- Latest published events
- Recently added content
- Website statistics (future phase)

---

### System Status
- Media Server health summary
- Disk usage
- CPU temperature
- RAM usage
- Backup status — last successful backup timestamp

---

## Navigation

Large TV-friendly buttons:

| Button | Action |
|---|---|
| Movies | Open Jellyfin Movies library |
| TV Shows | Open Jellyfin TV Shows library |
| Home Videos | Open Jellyfin Home Videos library |
| Sports | Open Jellyfin Sports library |
| Music | Open Jellyfin Music library |
| Settings | Open Sean Home settings page |

---

## Architecture

Sean Home runs entirely on the Raspberry Pi 4.

Sean OS (Pi 5) is intentionally excluded from v1.

Sean Home exposes clean internal APIs so Sean OS can consume or enhance it in the future without requiring architectural changes to Sean Home.

```
Browser / TV
     ↓  http://10.0.0.225:8097
Sean Home (Python FastAPI, port 8097)
     ↓ reads from
Jellyfin REST API (port 8096)     — media data, status, libraries
Open-Meteo API                    — weather, no API key required
ESPN API or similar               — sports scores and schedules
Google Calendar API               — calendar events
PlayStation API (if available)    — PSN status and trophies
Pi system metrics                 — disk, CPU, RAM, temp
```

---

## Future Sean OS Integration (Not Phase 1)

These are excluded from v1 and must not influence the Phase 1 architecture beyond API surface design.

| Future Feature | Source |
|---|---|
| Voice control | Pi 5 / Jarvis |
| Presence detection | Pi 5 / Aqara FP2 |
| Movie Night mode | Pi 5 event bus |
| Lighting automation | Pi 5 / Govee |
| LED panel notifications | Pi 5 / HUB75 panels |
| Sonos announcements | Pi 5 |
| AI recommendations | Pi 5 / Claude |
| Stadium Wall integration | Pi 5 |

---

## Development Rules

1. **Build incrementally.** Each module must be independently testable and independently deployable.
2. **Commit working milestones.** No partial, broken states on `main`.
3. **Document all APIs.** Every external data source must be documented in `ARCHITECTURE.md`.
4. **Never break the operational Media Server.** Sean Home is additive — Jellyfin must continue to function normally at all times.
5. **Fail gracefully.** If any data source is unavailable, that module shows a neutral placeholder. The dashboard never crashes because one API is down.
6. **No scraping.** All data must come from documented, supported APIs.

---

## Success Criteria

When I turn on the TV, Sean Home is the dashboard I naturally interact with before launching Jellyfin.

It feels fast, polished, reliable, and worthy of being the permanent home screen for my entertainment system.

| Check | Criteria |
|---|---|
| Load time | Dashboard fully rendered in under 2 seconds on local network |
| TV legibility | All text readable from 10 feet on a 65-inch screen |
| Uptime | Survives Pi reboot, auto-restarts via systemd |
| Graceful failure | Any unavailable module shows placeholder, rest of dashboard unaffected |
| Jellyfin integrity | Jellyfin continues to function identically with Sean Home running |
| GitHub | All working milestones committed and tagged |
