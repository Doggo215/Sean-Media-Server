"""
Sean Home v1.0 — FastAPI backend
Runs on port 8088 alongside Jellyfin (8096).
Phase 1A: scaffold, health, system status, static serving.
Phase 1B: weather (Open-Meteo, no auth, cached).
"""

import time
import shutil
import subprocess
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx
import psutil
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

DENVER = ZoneInfo("America/Denver")
START_TIME = time.time()

# Arvada, CO
WEATHER_LAT = 39.8028
WEATHER_LON = -105.0875
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_CACHE_TTL = 600  # 10 minutes — avoid hammering the free API

# Open-Meteo WMO weather codes → simple condition text + icon
WEATHER_CODES = {
    0: ("Clear", "☀️"),
    1: ("Mostly Clear", "🌤️"),
    2: ("Partly Cloudy", "⛅"),
    3: ("Overcast", "☁️"),
    45: ("Fog", "🌫️"),
    48: ("Fog", "🌫️"),
    51: ("Light Drizzle", "🌦️"),
    53: ("Drizzle", "🌦️"),
    55: ("Heavy Drizzle", "🌧️"),
    61: ("Light Rain", "🌦️"),
    63: ("Rain", "🌧️"),
    65: ("Heavy Rain", "🌧️"),
    66: ("Freezing Rain", "🌧️"),
    67: ("Freezing Rain", "🌧️"),
    71: ("Light Snow", "🌨️"),
    73: ("Snow", "🌨️"),
    75: ("Heavy Snow", "❄️"),
    77: ("Snow Grains", "🌨️"),
    80: ("Light Showers", "🌦️"),
    81: ("Showers", "🌧️"),
    82: ("Heavy Showers", "⛈️"),
    85: ("Snow Showers", "🌨️"),
    86: ("Snow Showers", "❄️"),
    95: ("Thunderstorm", "⛈️"),
    96: ("Thunderstorm", "⛈️"),
    99: ("Thunderstorm", "⛈️"),
}

_weather_cache = {"data": None, "fetched_at": 0}

# All Philadelphia teams share the "phi" team abbreviation in ESPN's API
SPORTS_TEAMS = {
    "phillies": {"label": "Phillies", "sport": "baseball", "league": "mlb", "team": "phi"},
    "eagles": {"label": "Eagles", "sport": "football", "league": "nfl", "team": "phi"},
    "sixers": {"label": "Sixers", "sport": "basketball", "league": "nba", "team": "phi"},
    "flyers": {"label": "Flyers", "sport": "hockey", "league": "nhl", "team": "phi"},
}

SPORTS_CACHE_TTL_LIVE = 60    # poll faster while a tracked game is in progress
SPORTS_CACHE_TTL_IDLE = 600   # otherwise match the weather cache cadence
_sports_cache = {"data": None, "fetched_at": 0, "ttl": SPORTS_CACHE_TTL_IDLE}

app = FastAPI(title="Sean Home", version="1.0.0")
app.mount("/static", StaticFiles(directory="/home/sean/sean-home/static"), name="static")
templates = Jinja2Templates(directory="/home/sean/sean-home/templates")


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "sean-home", "version": "1.0.0"}


# ─── System status ───────────────────────────────────────────────────────────

@app.get("/api/system")
def system_status():
    now = datetime.now(DENVER)
    uptime_seconds = int(time.time() - psutil.boot_time())

    # Disk — root filesystem
    disk = shutil.disk_usage("/")
    disk_pct = round(disk.used / disk.total * 100, 1)
    disk_free_gb = round(disk.free / 1024**3, 1)

    # Disk — /srv/media if mounted
    try:
        media_disk = shutil.disk_usage("/srv/media")
        media_pct = round(media_disk.used / media_disk.total * 100, 1)
        media_free_gb = round(media_disk.free / 1024**3, 1)
    except FileNotFoundError:
        media_pct = None
        media_free_gb = None

    # RAM
    ram = psutil.virtual_memory()
    ram_pct = ram.percent
    ram_available_mb = round(ram.available / 1024**2)

    # CPU temp (Pi-specific)
    try:
        result = subprocess.run(
            ["vcgencmd", "measure_temp"],
            capture_output=True, text=True, timeout=3
        )
        temp_str = result.stdout.strip()  # "temp=42.8'C"
        cpu_temp = float(temp_str.split("=")[1].replace("'C", ""))
    except Exception:
        cpu_temp = None

    # CPU usage (1-second sample)
    cpu_pct = psutil.cpu_percent(interval=1)

    return {
        "timestamp": now.isoformat(),
        "uptime_seconds": uptime_seconds,
        "disk": {
            "root_pct": disk_pct,
            "root_free_gb": disk_free_gb,
            "media_pct": media_pct,
            "media_free_gb": media_free_gb,
        },
        "ram": {
            "used_pct": ram_pct,
            "available_mb": ram_available_mb,
        },
        "cpu": {
            "used_pct": cpu_pct,
            "temp_c": cpu_temp,
        },
    }


# ─── Weather ──────────────────────────────────────────────────────────────────

async def fetch_weather():
    """Fetch from Open-Meteo. Raises on failure — caller decides fallback."""
    params = {
        "latitude": WEATHER_LAT,
        "longitude": WEATHER_LON,
        "current": "temperature_2m,weather_code",
        "daily": "temperature_2m_max,temperature_2m_min",
        "temperature_unit": "fahrenheit",
        "timezone": "America/Denver",
        "forecast_days": 1,
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(WEATHER_URL, params=params)
        resp.raise_for_status()
        return resp.json()


@app.get("/api/weather")
async def weather():
    now = time.time()

    if _weather_cache["data"] and (now - _weather_cache["fetched_at"]) < WEATHER_CACHE_TTL:
        return {**_weather_cache["data"], "cached": True}

    try:
        raw = await fetch_weather()
        code = raw["current"]["weather_code"]
        condition, icon = WEATHER_CODES.get(code, ("Unknown", "🌡️"))

        data = {
            "available": True,
            "temperature_f": round(raw["current"]["temperature_2m"]),
            "high_f": round(raw["daily"]["temperature_2m_max"][0]),
            "low_f": round(raw["daily"]["temperature_2m_min"][0]),
            "condition": condition,
            "icon": icon,
            "location": "Arvada, CO",
        }
        _weather_cache["data"] = data
        _weather_cache["fetched_at"] = now
        return {**data, "cached": False}

    except Exception:
        # Fail gracefully — serve stale cache if we have one, otherwise unavailable
        if _weather_cache["data"]:
            return {**_weather_cache["data"], "cached": True, "stale": True}
        return JSONResponse(
            status_code=200,
            content={"available": False, "location": "Arvada, CO"},
        )


# ─── Sports ──────────────────────────────────────────────────────────────────

async def fetch_team_schedule(client, sport, league, team):
    url = f"https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{team}/schedule"
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.json()


async def fetch_world_cup_scoreboard(client):
    url = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.json()


def _to_mt_strings(event_dt):
    mt = event_dt.astimezone(DENVER)
    return mt.strftime("%a %b %-d"), mt.strftime("%-I:%M %p MT")


def _score_str(competitor):
    """ESPN returns score as {"value": 7.0, "displayValue": "7"} — extract the display string."""
    score = competitor.get("score")
    if isinstance(score, dict):
        return score.get("displayValue", "—")
    return score if score is not None else "—"


def parse_team_events(payload, team_abbr):
    """Pick the next upcoming game, most recent final, and any live game for a team."""
    events = payload.get("events", [])
    now = datetime.now(timezone.utc)

    next_game, next_dt = None, None
    last_game, last_dt = None, None
    live_game = None

    for ev in events:
        try:
            comp = ev["competitions"][0]
            state = comp["status"]["type"]["state"]  # "pre" | "in" | "post"
            event_dt = datetime.fromisoformat(ev["date"].replace("Z", "+00:00"))
            competitors = comp["competitors"]
            me = next((c for c in competitors if c["team"]["abbreviation"].lower() == team_abbr.lower()), None)
            opp = next((c for c in competitors if c["team"]["abbreviation"].lower() != team_abbr.lower()), None)
            if not me or not opp:
                continue

            date_str, time_str = _to_mt_strings(event_dt)
            opponent_name = opp["team"].get("shortDisplayName") or opp["team"].get("abbreviation")
            entry = {
                "opponent": opponent_name,
                "date": date_str,
                "time": time_str,
                "home_away": me.get("homeAway"),
            }

            if state == "in":
                entry["my_score"] = _score_str(me)
                entry["opp_score"] = _score_str(opp)
                entry["period"] = comp["status"]["type"].get("shortDetail")
                live_game = entry
            elif state == "post":
                entry["my_score"] = _score_str(me)
                entry["opp_score"] = _score_str(opp)
                entry["result"] = "W" if me.get("winner") is True else ("L" if opp.get("winner") is True else "T")
                if last_dt is None or event_dt > last_dt:
                    last_game, last_dt = entry, event_dt
            elif state == "pre":
                if event_dt >= now and (next_dt is None or event_dt < next_dt):
                    next_game, next_dt = entry, event_dt
        except Exception:
            continue

    return {"next": next_game, "last": last_game, "live": live_game}


def parse_world_cup(payload):
    """World Cup has no single tracked team — summarize across all current matches."""
    events = payload.get("events", [])
    now = datetime.now(timezone.utc)

    next_match, next_dt = None, None
    last_match, last_dt = None, None
    live_match = None

    for ev in events:
        try:
            comp = ev["competitions"][0]
            state = comp["status"]["type"]["state"]
            event_dt = datetime.fromisoformat(ev["date"].replace("Z", "+00:00"))
            competitors = comp["competitors"]
            home = next(c for c in competitors if c["homeAway"] == "home")
            away = next(c for c in competitors if c["homeAway"] == "away")

            date_str, time_str = _to_mt_strings(event_dt)
            entry = {
                "matchup": f"{away['team'].get('shortDisplayName')} @ {home['team'].get('shortDisplayName')}",
                "date": date_str,
                "time": time_str,
            }

            if state == "in":
                entry["score"] = f"{_score_str(away)}-{_score_str(home)}"
                entry["period"] = comp["status"]["type"].get("shortDetail")
                live_match = entry
            elif state == "post":
                if last_dt is None or event_dt > last_dt:
                    entry["score"] = f"{_score_str(away)}-{_score_str(home)}"
                    last_match, last_dt = entry, event_dt
            elif state == "pre":
                if event_dt >= now and (next_dt is None or event_dt < next_dt):
                    next_match, next_dt = entry, event_dt
        except Exception:
            continue

    return {"next": next_match, "last": last_match, "live": live_match}


@app.get("/api/sports")
async def sports():
    now = time.time()

    if _sports_cache["data"] and (now - _sports_cache["fetched_at"]) < _sports_cache["ttl"]:
        return {**_sports_cache["data"], "cached": True}

    result = {"available": True, "teams": {}}
    any_live = False

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            for key, cfg in SPORTS_TEAMS.items():
                try:
                    payload = await fetch_team_schedule(client, cfg["sport"], cfg["league"], cfg["team"])
                    parsed = parse_team_events(payload, cfg["team"])
                    result["teams"][key] = {"label": cfg["label"], "available": True, **parsed}
                    if parsed["live"]:
                        any_live = True
                except Exception:
                    result["teams"][key] = {"label": cfg["label"], "available": False}

            try:
                wc_payload = await fetch_world_cup_scoreboard(client)
                wc_parsed = parse_world_cup(wc_payload)
                result["teams"]["world_cup"] = {"label": "World Cup", "available": True, **wc_parsed}
                if wc_parsed["live"]:
                    any_live = True
            except Exception:
                result["teams"]["world_cup"] = {"label": "World Cup", "available": False}
    except Exception:
        # Fail gracefully — serve stale cache if we have one, otherwise unavailable
        if _sports_cache["data"]:
            return {**_sports_cache["data"], "cached": True, "stale": True}
        return JSONResponse(status_code=200, content={"available": False})

    result["live_active"] = any_live
    ttl = SPORTS_CACHE_TTL_LIVE if any_live else SPORTS_CACHE_TTL_IDLE
    _sports_cache["data"] = result
    _sports_cache["fetched_at"] = now
    _sports_cache["ttl"] = ttl
    return {**result, "cached": False}


# ─── Dashboard ───────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    now = datetime.now(DENVER)
    return templates.TemplateResponse("index.html", {
        "request": request,
        "time": now.strftime("%-I:%M %p"),
        "date": now.strftime("%A, %B %-d, %Y"),
    })
