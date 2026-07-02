"""
Sean Home v1.0 — FastAPI backend
Runs on port 8088 alongside Jellyfin (8096).
Phase 1A: scaffold, health, system status, static serving.
Phase 1B: weather (Open-Meteo, no auth, cached).
"""

import asyncio
import time
import shutil
import subprocess
from datetime import datetime, timezone, timedelta
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
    "phillies": {"label": "Phillies", "sport": "baseball", "league": "mlb", "team": "phi", "espn_id": "22"},
    "eagles": {"label": "Eagles", "sport": "football", "league": "nfl", "team": "phi", "espn_id": "21"},
    "sixers": {"label": "Sixers", "sport": "basketball", "league": "nba", "team": "phi", "espn_id": "20"},
    "flyers": {"label": "Flyers", "sport": "hockey", "league": "nhl", "team": "phi", "espn_id": "4"},
}

SPORTS_CACHE_TTL_LIVE = 60    # poll faster while a tracked game is in progress
SPORTS_CACHE_TTL_IDLE = 600   # otherwise match the weather cache cadence
_sports_cache = {"data": None, "fetched_at": 0, "ttl": SPORTS_CACHE_TTL_IDLE}

# fortnite-api.com — free, public, no auth required
FORTNITE_NEWS_URL = "https://fortnite-api.com/v2/news/br"
FORTNITE_SHOP_URL = "https://fortnite-api.com/v2/shop"
# Epic's own status page API — public, no auth, standard statuspage.io format
EPIC_STATUS_URL = "https://status.epicgames.com/api/v2/summary.json"

GAMING_CACHE_TTL = 1800  # 30 min — shop/news/status don't change minute to minute
_gaming_cache = {"data": None, "fetched_at": 0}

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
        "current": (
            "temperature_2m,weather_code,apparent_temperature,"
            "relative_humidity_2m,precipitation_probability,wind_speed_10m"
        ),
        "hourly": "temperature_2m,precipitation_probability,weather_code",
        "daily": (
            "temperature_2m_max,temperature_2m_min,weather_code,"
            "precipitation_probability_max,sunrise,sunset"
        ),
        "temperature_unit": "fahrenheit",
        "wind_speed_unit": "mph",
        "timezone": "America/Denver",
        "forecast_days": 7,
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(WEATHER_URL, params=params)
        resp.raise_for_status()
        return resp.json()


def _fmt_sun(dt_str):
    """'2026-07-02T05:48' → '5:48 AM'"""
    return datetime.fromisoformat(dt_str).strftime("%-I:%M %p")


@app.get("/api/weather")
async def weather():
    now = time.time()

    if _weather_cache["data"] and (now - _weather_cache["fetched_at"]) < WEATHER_CACHE_TTL:
        return {**_weather_cache["data"], "cached": True}

    try:
        raw = await fetch_weather()
        cur = raw["current"]
        daily = raw["daily"]
        hourly = raw["hourly"]

        code = cur["weather_code"]
        condition, icon = WEATHER_CODES.get(code, ("Unknown", "🌡️"))

        # Hourly — next 6 hours from current hour
        now_dt = datetime.now(DENVER)
        now_hour_str = now_dt.strftime("%Y-%m-%dT%H:00")
        h_times = hourly["time"]
        try:
            h_start = h_times.index(now_hour_str)
        except ValueError:
            h_start = 0
        hourly_out = []
        for i in range(h_start, min(h_start + 7, len(h_times))):
            h_code = hourly["weather_code"][i]
            h_cond, h_icon = WEATHER_CODES.get(h_code, ("Unknown", "🌡️"))
            h_dt = datetime.fromisoformat(h_times[i])
            label = "Now" if i == h_start else h_dt.strftime("%-I %p")
            hourly_out.append({
                "label": label,
                "temp_f": round(hourly["temperature_2m"][i]),
                "icon": h_icon,
                "condition": h_cond,
                "precip_chance": round(hourly["precipitation_probability"][i]),
            })

        # Tomorrow (daily index 1)
        t_code = daily["weather_code"][1]
        t_cond, t_icon = WEATHER_CODES.get(t_code, ("Unknown", "🌡️"))
        tomorrow = {
            "condition": t_cond,
            "icon": t_icon,
            "high_f": round(daily["temperature_2m_max"][1]),
            "low_f": round(daily["temperature_2m_min"][1]),
            "precip_chance": round(daily["precipitation_probability_max"][1]),
        }

        # Weekend preview — first Sat or Sun in the next 3-day window
        weekend = None
        for i in [1, 2]:
            day_dt = now_dt + timedelta(days=i)
            if day_dt.weekday() >= 5:
                w_code = daily["weather_code"][i]
                w_cond, w_icon = WEATHER_CODES.get(w_code, ("Unknown", "🌡️"))
                weekend = {
                    "day": day_dt.strftime("%A"),
                    "condition": w_cond,
                    "icon": w_icon,
                    "high_f": round(daily["temperature_2m_max"][i]),
                    "low_f": round(daily["temperature_2m_min"][i]),
                    "precip_chance": round(daily["precipitation_probability_max"][i]),
                }
                break

        # 5-day forecast array (days 1–5, skipping today at index 0)
        daily_out = []
        for i in range(1, min(6, len(daily["weather_code"]))):
            d_dt = now_dt + timedelta(days=i)
            d_code = daily["weather_code"][i]
            d_cond, d_icon = WEATHER_CODES.get(d_code, ("Unknown", "🌡️"))
            daily_out.append({
                "label": d_dt.strftime("%a %-m/%-d"),
                "condition": d_cond,
                "icon": d_icon,
                "high_f": round(daily["temperature_2m_max"][i]),
                "low_f": round(daily["temperature_2m_min"][i]),
                "precip_chance": round(daily["precipitation_probability_max"][i]),
            })

        data = {
            "available": True,
            "temperature_f": round(cur["temperature_2m"]),
            "feels_like_f": round(cur["apparent_temperature"]),
            "high_f": round(daily["temperature_2m_max"][0]),
            "low_f": round(daily["temperature_2m_min"][0]),
            "condition": condition,
            "icon": icon,
            "humidity_pct": round(cur["relative_humidity_2m"]),
            "precip_chance": round(cur.get("precipitation_probability", 0)),
            "wind_mph": round(cur["wind_speed_10m"]),
            "sunrise": _fmt_sun(daily["sunrise"][0]),
            "sunset": _fmt_sun(daily["sunset"][0]),
            "hourly": hourly_out,
            "daily": daily_out,
            "tomorrow": tomorrow,
            "weekend": weekend,
            "location": "Arvada, CO",
        }
        _weather_cache["data"] = data
        _weather_cache["fetched_at"] = now
        return {**data, "cached": False}

    except Exception:
        if _weather_cache["data"]:
            return {**_weather_cache["data"], "cached": True, "stale": True}
        return JSONResponse(
            status_code=200,
            content={"available": False, "location": "Arvada, CO"},
        )


# ─── Media Server Status ─────────────────────────────────────────────────────

import os

MEDIA_SERVER_SERVICES = {
    "jellyfin": "Jellyfin",
    "smbd": "Samba",
    "sean-home": "Sean Home",
}
MEDIA_ROOT = "/srv/media"

_media_server_cache = {"data": None, "fetched_at": 0}
MEDIA_SERVER_CACHE_TTL = 60  # refresh every minute — services can change state


def _service_status(name: str) -> str:
    """Return 'active', 'inactive', or 'unknown' for a systemd service."""
    try:
        result = subprocess.run(
            ["systemctl", "is-active", name],
            capture_output=True, text=True, timeout=3
        )
        return result.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def _last_media_import() -> dict:
    """Find the most recently modified item inside /srv/media."""
    try:
        entries = []
        for entry in os.scandir(MEDIA_ROOT):
            entries.append((entry.stat().st_mtime, entry.name))
        if not entries:
            return {"available": False}
        entries.sort(reverse=True)
        mtime, name = entries[0]
        dt = datetime.fromtimestamp(mtime, tz=DENVER)
        return {
            "available": True,
            "folder": name,
            "date": dt.strftime("%a %b %-d, %Y"),
            "time": dt.strftime("%-I:%M %p MT"),
        }
    except Exception:
        return {"available": False}


@app.get("/api/media-server")
def media_server():
    now = time.time()
    if _media_server_cache["data"] and (now - _media_server_cache["fetched_at"]) < MEDIA_SERVER_CACHE_TTL:
        return {**_media_server_cache["data"], "cached": True}

    try:
        services = {key: _service_status(key) for key in MEDIA_SERVER_SERVICES}

        disk = shutil.disk_usage("/")
        disk_pct = round(disk.used / disk.total * 100, 1)
        disk_free_gb = round(disk.free / 1024 ** 3, 1)
        disk_total_gb = round(disk.total / 1024 ** 3, 1)

        ram = psutil.virtual_memory()

        try:
            tmp = subprocess.run(
                ["vcgencmd", "measure_temp"],
                capture_output=True, text=True, timeout=3
            )
            cpu_temp = float(tmp.stdout.strip().split("=")[1].replace("'C", ""))
        except Exception:
            cpu_temp = None

        uptime_seconds = int(time.time() - psutil.boot_time())
        hours, remainder = divmod(uptime_seconds, 3600)
        minutes = remainder // 60
        uptime_str = f"{hours}h {minutes}m" if hours else f"{minutes}m"

        data = {
            "available": True,
            "services": {
                key: {
                    "label": MEDIA_SERVER_SERVICES[key],
                    "status": services[key],
                }
                for key in MEDIA_SERVER_SERVICES
            },
            "disk": {
                "pct": disk_pct,
                "free_gb": disk_free_gb,
                "total_gb": disk_total_gb,
            },
            "ram": {
                "used_pct": ram.percent,
                "available_mb": round(ram.available / 1024 ** 2),
            },
            "cpu": {
                "temp_c": cpu_temp,
            },
            "uptime": uptime_str,
            "last_import": _last_media_import(),
            "backup": {
                "available": False,
                "note": "Backups run from Mac — not tracked from Pi",
            },
            "media_drop": {
                "available": False,
                "note": "Media Drop runs on Mac — not tracked from Pi",
            },
        }
        _media_server_cache["data"] = data
        _media_server_cache["fetched_at"] = now
        return {**data, "cached": False}

    except Exception:
        if _media_server_cache["data"]:
            return {**_media_server_cache["data"], "cached": True, "stale": True}
        return JSONResponse(status_code=200, content={"available": False})


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
            opp_abbr = opp["team"].get("abbreviation", "").lower()
            opp_records = opp.get("records") or []
            opp_record = next((r.get("summary", "") for r in opp_records if r.get("name") == "overall"), "")
            entry = {
                "opponent": opponent_name,
                "opponent_abbr": opp_abbr,
                "opponent_record": opp_record,
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
    """World Cup — returns all today's MT games plus next/last/live for compat."""
    events = payload.get("events", [])
    now = datetime.now(timezone.utc)
    today_mt = now.astimezone(DENVER).strftime("%Y-%m-%d")

    today_games: list = []
    next_match, next_dt = None, None
    last_match, last_dt = None, None
    live_match = None

    for ev in events:
        try:
            comp = ev["competitions"][0]
            state = comp["status"]["type"]["state"]
            event_dt = datetime.fromisoformat(ev["date"].replace("Z", "+00:00"))
            mt_date = event_dt.astimezone(DENVER).strftime("%Y-%m-%d")
            competitors = comp["competitors"]
            home = next(c for c in competitors if c["homeAway"] == "home")
            away = next(c for c in competitors if c["homeAway"] == "away")

            date_str, time_str = _to_mt_strings(event_dt)
            home_name = home["team"].get("shortDisplayName", "")
            away_name = away["team"].get("shortDisplayName", "")
            home_id = home["team"].get("id", "")
            away_id = away["team"].get("id", "")
            home_abbr = home["team"].get("abbreviation", "")
            away_abbr = away["team"].get("abbreviation", "")

            # Round / phase (e.g. "Group Stage", "Round of 16")
            comp_type = (comp.get("type") or {}).get("text", "")
            notes = comp.get("notes") or []
            round_label = next((n.get("headline", "") for n in notes if n.get("type") == "rotation"), comp_type)

            entry = {
                "matchup": f"{away_name} @ {home_name}",
                "away": away_name,
                "home": home_name,
                "away_abbr": away_abbr,
                "home_abbr": home_abbr,
                "date": date_str,
                "time": time_str,
                "state": state,
                "round": round_label,
            }

            if state == "in":
                entry["score"] = f"{_score_str(away)}-{_score_str(home)}"
                entry["period"] = comp["status"]["type"].get("shortDetail")
                # Goal scorers from competition details
                goals = []
                for detail in (comp.get("details") or []):
                    dtype = (detail.get("type") or {}).get("text", "").lower()
                    if dtype in ("goal", "penalty goal", "header goal", "own goal"):
                        athletes = detail.get("athletesInvolved") or []
                        player = athletes[0].get("displayName", "") if athletes else ""
                        minute = (detail.get("clock") or {}).get("displayValue", "")
                        team_id = (detail.get("team") or {}).get("id", "")
                        side = "home" if team_id == home_id else "away"
                        goals.append({"player": player, "minute": minute, "side": side})
                entry["goals"] = goals
                live_match = entry
            elif state == "post":
                entry["score"] = f"{_score_str(away)}-{_score_str(home)}"
                if last_dt is None or event_dt > last_dt:
                    last_match, last_dt = entry, event_dt
            elif state == "pre":
                if event_dt >= now and (next_dt is None or event_dt < next_dt):
                    next_match, next_dt = entry, event_dt

            # Collect all today's MT games (ESPN returns events in time order)
            if mt_date == today_mt:
                today_games.append(entry)
        except Exception:
            continue

    return {
        "next": next_match,
        "last": last_match,
        "live": live_match,
        "today_games": today_games,
    }


async def fetch_team_info(client, sport, league, team_abbr):
    """Returns team record and standing summary."""
    url = f"https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{team_abbr}"
    resp = await client.get(url)
    resp.raise_for_status()
    data = resp.json()
    team = (data.get("team") or {})
    record_items = ((team.get("record") or {}).get("items") or [])
    record = record_items[0].get("summary", "") if record_items else ""
    standing = team.get("standingSummary", "")
    return {"record": record, "standing": standing}


async def fetch_team_news(client, sport, league, team_abbr):
    """Returns the latest news headline for a team."""
    url = f"https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/news?team={team_abbr}&limit=1"
    resp = await client.get(url)
    resp.raise_for_status()
    data = resp.json()
    articles = data.get("articles") or []
    if articles:
        return articles[0].get("headline", "")
    return ""


async def fetch_mlb_scoreboard(client):
    """Returns today's MLB scoreboard, which includes probable pitchers."""
    url = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard"
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.json()


def parse_pitcher(probables):
    """Extract pitcher name + stats from ESPN probables array."""
    if not probables:
        return None
    p = probables[0]
    athlete = p.get("athlete") or {}
    stats = {s["name"]: s.get("displayValue", "—") for s in (p.get("statistics") or [])}
    return {
        "name": athlete.get("shortName") or athlete.get("fullName") or "TBD",
        "W": stats.get("wins", "—"),
        "L": stats.get("losses", "—"),
        "ERA": stats.get("ERA", "—"),
    }


def find_phillies_pitchers(scoreboard_payload, phillies_abbr="PHI"):
    """Find the Phillies game in today's scoreboard and return both pitchers."""
    for ev in scoreboard_payload.get("events", []):
        try:
            comp = ev["competitions"][0]
            competitors = comp["competitors"]
            me = next((c for c in competitors if c["team"]["abbreviation"].upper() == phillies_abbr), None)
            opp = next((c for c in competitors if c["team"]["abbreviation"].upper() != phillies_abbr), None)
            if not me or not opp:
                continue
            return {
                "home": parse_pitcher(me.get("probables")),
                "away": parse_pitcher(opp.get("probables")),
                "home_abbr": me["team"]["abbreviation"].lower(),
                "away_abbr": opp["team"]["abbreviation"].lower(),
            }
        except Exception:
            continue
    return None


@app.get("/api/sports")
async def sports():
    now = time.time()

    if _sports_cache["data"] and (now - _sports_cache["fetched_at"]) < _sports_cache["ttl"]:
        return {**_sports_cache["data"], "cached": True}

    result = {"available": True, "teams": {}}
    any_live = False

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # Fetch all schedules + WC + mlb scoreboard in parallel
            team_keys = list(SPORTS_TEAMS.keys())
            team_cfgs = list(SPORTS_TEAMS.values())

            schedule_tasks = [
                fetch_team_schedule(client, cfg["sport"], cfg["league"], cfg["team"])
                for cfg in team_cfgs
            ]
            info_tasks = [
                fetch_team_info(client, cfg["sport"], cfg["league"], cfg["team"])
                for cfg in team_cfgs
            ]
            news_tasks = [
                fetch_team_news(client, cfg["sport"], cfg["league"], cfg["team"])
                for cfg in team_cfgs
            ]

            (
                schedule_results,
                info_results,
                news_results,
                wc_payload,
                mlb_scoreboard,
            ) = await asyncio.gather(
                asyncio.gather(*schedule_tasks, return_exceptions=True),
                asyncio.gather(*info_tasks, return_exceptions=True),
                asyncio.gather(*news_tasks, return_exceptions=True),
                fetch_world_cup_scoreboard(client),
                fetch_mlb_scoreboard(client),
                return_exceptions=True,
            )

            # Phillies probable pitchers (from mlb scoreboard)
            phillies_pitchers = None
            if not isinstance(mlb_scoreboard, Exception):
                phillies_pitchers = find_phillies_pitchers(mlb_scoreboard)

            for i, key in enumerate(team_keys):
                cfg = team_cfgs[i]
                schedule_payload = schedule_results[i] if not isinstance(schedule_results, Exception) else None
                if schedule_payload is None or isinstance(schedule_payload, Exception):
                    result["teams"][key] = {"label": cfg["label"], "available": False}
                    continue

                parsed = parse_team_events(schedule_payload, cfg["team"])
                entry = {"label": cfg["label"], "available": True, **parsed}

                # Merge team record/standing
                info = info_results[i] if not isinstance(info_results, Exception) else None
                if info and not isinstance(info, Exception):
                    entry["record"] = info.get("record", "")
                    entry["standing"] = info.get("standing", "")

                # Merge news headline (shown in offseason when no live/next games)
                news = news_results[i] if not isinstance(news_results, Exception) else None
                if news and not isinstance(news, Exception):
                    entry["headline"] = news

                # Phillies only: attach probable pitchers
                if key == "phillies" and phillies_pitchers:
                    entry["pitchers"] = phillies_pitchers

                if parsed["live"]:
                    any_live = True

                result["teams"][key] = entry

            # World Cup
            if not isinstance(wc_payload, Exception):
                wc_parsed = parse_world_cup(wc_payload)
                result["teams"]["world_cup"] = {"label": "World Cup", "available": True, **wc_parsed}
                if wc_parsed["live"]:
                    any_live = True
            else:
                result["teams"]["world_cup"] = {"label": "World Cup", "available": False}

    except Exception:
        if _sports_cache["data"]:
            return {**_sports_cache["data"], "cached": True, "stale": True}
        return JSONResponse(status_code=200, content={"available": False})

    result["live_active"] = any_live
    ttl = SPORTS_CACHE_TTL_LIVE if any_live else SPORTS_CACHE_TTL_IDLE
    _sports_cache["data"] = result
    _sports_cache["fetched_at"] = now
    _sports_cache["ttl"] = ttl
    return {**result, "cached": False}


# ─── Gaming ──────────────────────────────────────────────────────────────────

async def fetch_fortnite_news(client):
    resp = await client.get(FORTNITE_NEWS_URL)
    resp.raise_for_status()
    return resp.json()


async def fetch_fortnite_shop(client):
    resp = await client.get(FORTNITE_SHOP_URL)
    resp.raise_for_status()
    return resp.json()


async def fetch_epic_status(client):
    resp = await client.get(EPIC_STATUS_URL)
    resp.raise_for_status()
    return resp.json()


def parse_fortnite_news(payload):
    motds = ((payload.get("data") or {}).get("motds") or [])[:3]
    return [{"title": m.get("title"), "body": m.get("body")} for m in motds if m.get("title")]


def parse_fortnite_shop(payload):
    entries = ((payload.get("data") or {}).get("entries") or [])[:6]
    items = []
    for e in entries:
        br_items = e.get("brItems") or []
        name = br_items[0]["name"] if br_items else (e.get("layout") or {}).get("name", "Item")
        items.append({"name": name, "price": e.get("finalPrice")})
    return items


def parse_epic_status(payload):
    components = payload.get("components") or []
    fortnite_component = next((c for c in components if "fortnite" in c.get("name", "").lower()), None)
    if fortnite_component:
        return fortnite_component.get("status")
    return (payload.get("status") or {}).get("description")


@app.get("/api/gaming")
async def gaming():
    now = time.time()

    if _gaming_cache["data"] and (now - _gaming_cache["fetched_at"]) < GAMING_CACHE_TTL:
        return {**_gaming_cache["data"], "cached": True}

    fortnite = {"available": False, "news": [], "shop": [], "status": None}
    got_any = False

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            fortnite["news"] = parse_fortnite_news(await fetch_fortnite_news(client))
            got_any = True
        except Exception:
            pass

        try:
            fortnite["shop"] = parse_fortnite_shop(await fetch_fortnite_shop(client))
            got_any = True
        except Exception:
            pass

        try:
            fortnite["status"] = parse_epic_status(await fetch_epic_status(client))
            got_any = True
        except Exception:
            pass

    fortnite["available"] = got_any

    # PSN has no supported public API for friends/presence — these stay
    # permanent placeholders until an official integration exists.
    result = {
        "available": True,
        "fortnite": fortnite,
        "playstation": {
            "available": False,
            "placeholder": "PlayStation status — coming soon (requires an official API)",
        },
        "friends_online": {
            "available": False,
            "placeholder": "Friends online — coming soon",
        },
    }

    _gaming_cache["data"] = result
    _gaming_cache["fetched_at"] = now
    return {**result, "cached": False}


# ─── Major News (RSS) ────────────────────────────────────────────────────────

import xml.etree.ElementTree as ET  # stdlib — no extra dep

NEWS_CACHE_TTL = 600  # 10 minutes
_news_cache: dict = {"data": None, "fetched_at": 0}

NEWS_FEEDS = [
    {"category": "LOCAL",  "source": "Colorado Sun",  "url": "https://coloradosun.com/feed/"},
    {"category": "U.S.",   "source": "NY Times",     "url": "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml"},
    {"category": "WORLD",  "source": "BBC World",    "url": "https://feeds.bbci.co.uk/news/world/rss.xml"},
]


async def _fetch_rss_headline(client: httpx.AsyncClient, feed: dict) -> dict | None:
    try:
        resp = await client.get(
            feed["url"], timeout=5.0,
            headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"},
            follow_redirects=True,
        )
        resp.raise_for_status()
        root = ET.fromstring(resp.text)
        # RSS items can be at channel/item or directly under root
        items = root.findall(".//item")
        if not items:
            return None
        title = (items[0].findtext("title") or "").strip()
        if not title:
            return None
        return {"category": feed["category"], "headline": title, "source": feed["source"]}
    except Exception:
        return None


@app.get("/api/news")
async def news():
    now = time.time()
    if _news_cache["data"] and (now - _news_cache["fetched_at"]) < NEWS_CACHE_TTL:
        return {**_news_cache["data"], "cached": True}
    try:
        async with httpx.AsyncClient() as client:
            results = await asyncio.gather(
                *[_fetch_rss_headline(client, f) for f in NEWS_FEEDS],
                return_exceptions=True,
            )
        major = [r for r in results if isinstance(r, dict)]
        data = {"available": True, "major": major}
        _news_cache["data"] = data
        _news_cache["fetched_at"] = now
        return {**data, "cached": False}
    except Exception:
        if _news_cache["data"]:
            return {**_news_cache["data"], "cached": True}
        return {"available": False, "major": []}


# ─── Jellyfin ────────────────────────────────────────────────────────────────

JELLYFIN_BASE = os.environ.get("JELLYFIN_URL", "http://127.0.0.1:8096")
JELLYFIN_KEY  = os.environ.get("JELLYFIN_API_KEY", "")
JELLYFIN_USER = os.environ.get("JELLYFIN_USER_ID", "")
JELLYFIN_CACHE_TTL = 300  # 5 min — library doesn't change by the minute

_jellyfin_cache = {"data": None, "fetched_at": 0}


def _jf_headers() -> dict:
    return {"Authorization": f'MediaBrowser Token="{JELLYFIN_KEY}"'}


def _format_runtime(ticks) -> str | None:
    """Convert Jellyfin runtime ticks (100-nanosecond units) to h:mm."""
    if not ticks:
        return None
    minutes = ticks // 600_000_000
    h, m = divmod(minutes, 60)
    return f"{h}h {m:02d}m" if h else f"{m}m"


def _item_label(item: dict) -> str:
    """Build a human-readable label: Series S01E02, or Movie (2024)."""
    itype = item.get("Type", "")
    name  = item.get("Name", "Unknown")
    if itype == "Episode":
        series  = item.get("SeriesName", "")
        season  = item.get("ParentIndexNumber")
        episode = item.get("IndexNumber")
        ep_str  = f"S{season:02d}E{episode:02d}" if season and episode else ""
        return f"{series} {ep_str} — {name}".strip() if series else name
    year = item.get("ProductionYear")
    return f"{name} ({year})" if year else name


async def fetch_jellyfin(client: httpx.AsyncClient) -> dict:
    if not JELLYFIN_KEY or not JELLYFIN_USER:
        return {"available": False, "reason": "not configured"}

    headers = _jf_headers()

    # Recently Added — up to 8 items across all libraries
    recently_added: list = []
    try:
        resp = await client.get(
            f"{JELLYFIN_BASE}/Users/{JELLYFIN_USER}/Items/Latest",
            headers=headers,
            params={
                "Limit": 8,
                "Fields": "ProductionYear,SeriesName,ParentIndexNumber,IndexNumber,RunTimeTicks",
                "EnableImageTypes": "Primary",
            },
        )
        resp.raise_for_status()
        for item in resp.json():
            recently_added.append({
                "id":      item.get("Id"),
                "label":   _item_label(item),
                "type":    item.get("Type"),
                "runtime": _format_runtime(item.get("RunTimeTicks")),
            })
    except Exception:
        pass  # recently_added stays empty — partial failure is fine

    # Continue Watching — resumable items
    continue_watching: list = []
    try:
        resp = await client.get(
            f"{JELLYFIN_BASE}/Users/{JELLYFIN_USER}/Items",
            headers=headers,
            params={
                "SortBy": "DatePlayed",
                "SortOrder": "Descending",
                "Filters": "IsResumable",
                "Limit": 5,
                "Fields": "ProductionYear,SeriesName,ParentIndexNumber,IndexNumber,RunTimeTicks,UserData",
                "Recursive": "true",
            },
        )
        resp.raise_for_status()
        for item in (resp.json().get("Items") or []):
            ud = item.get("UserData") or {}
            pct = round(ud.get("PlayedPercentage") or 0)
            continue_watching.append({
                "id":       item.get("Id"),
                "label":    _item_label(item),
                "type":     item.get("Type"),
                "progress": pct,
            })
    except Exception:
        pass  # continue_watching stays empty

    available = bool(recently_added or continue_watching)
    return {
        "available": available,
        "recently_added": recently_added,
        "continue_watching": continue_watching,
    }


@app.get("/api/jellyfin")
async def jellyfin():
    now = time.time()
    if _jellyfin_cache["data"] and (now - _jellyfin_cache["fetched_at"]) < JELLYFIN_CACHE_TTL:
        return {**_jellyfin_cache["data"], "cached": True}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            data = await fetch_jellyfin(client)
    except Exception:
        if _jellyfin_cache["data"]:
            return {**_jellyfin_cache["data"], "cached": True, "stale": True}
        return JSONResponse(status_code=200, content={"available": False})

    _jellyfin_cache["data"] = data
    _jellyfin_cache["fetched_at"] = now
    return {**data, "cached": False}


# ─── Tonight ─────────────────────────────────────────────────────────────────

@app.get("/api/tonight")
async def tonight():
    """
    Read-only aggregator — draws from existing caches, no new external calls
    except a cold-start weather fetch. Answer: "What should I know tonight?"
    """
    now_mt = datetime.now(DENVER)
    today_str = now_mt.strftime("%a %b %-d")  # e.g. "Tue Jun 30"

    result: dict = {
        "available": True,
        "as_of": now_mt.strftime("%-I:%M %p MT"),
    }

    # ── Weather ──────────────────────────────────────────────────────────────
    try:
        wd = _weather_cache["data"]
        if not wd:
            # Cache is cold on first load — trigger a fresh pull
            try:
                raw = await fetch_weather()
                code = raw["current"]["weather_code"]
                condition, icon = WEATHER_CODES.get(code, ("Unknown", "🌡️"))
                wd = {
                    "available": True,
                    "temperature_f": round(raw["current"]["temperature_2m"]),
                    "high_f": round(raw["daily"]["temperature_2m_max"][0]),
                    "low_f": round(raw["daily"]["temperature_2m_min"][0]),
                    "condition": condition,
                    "icon": icon,
                    "location": "Arvada, CO",
                }
                _weather_cache["data"] = wd
                _weather_cache["fetched_at"] = time.time()
            except Exception:
                wd = None

        if wd and wd.get("available"):
            result["weather"] = {
                "available": True,
                "temp_f": wd["temperature_f"],
                "low_f": wd["low_f"],
                "condition": wd["condition"],
                "icon": wd["icon"],
            }
        else:
            result["weather"] = {"available": False}
    except Exception:
        result["weather"] = {"available": False}

    # ── Sports ───────────────────────────────────────────────────────────────
    try:
        sd = _sports_cache["data"]
        live_games: list = []
        upcoming_games: list = []
        final_games: list = []

        if sd and sd.get("available"):
            for key, team in sd.get("teams", {}).items():
                if not team.get("available", True):
                    continue
                label = team.get("label", key)

                if team.get("live"):
                    g = team["live"]
                    score = g.get("score") or f"{g.get('my_score', '—')}-{g.get('opp_score', '—')}"
                    live_games.append({
                        "team": label,
                        "opponent": g.get("opponent") or g.get("matchup", ""),
                        "score": score,
                        "period": g.get("period"),
                    })

                if key == "world_cup":
                    # Add ALL today's WC games as a single grouped entry
                    today_wc = [g for g in team.get("today_games", []) if g.get("state") != "post"]
                    if today_wc:
                        upcoming_games.append({
                            "team": "World Cup",
                            "opponent": today_wc[0].get("matchup", ""),
                            "time": today_wc[0].get("time", ""),
                            "wc_games": today_wc,
                        })
                elif team.get("next") and team["next"].get("date") == today_str:
                    g = team["next"]
                    upcoming_games.append({
                        "team": label,
                        "opponent": g.get("opponent") or g.get("matchup", ""),
                        "time": g.get("time"),
                    })

                if team.get("last") and team["last"].get("date") == today_str:
                    g = team["last"]
                    score = g.get("score") or f"{g.get('my_score', '—')}-{g.get('opp_score', '—')}"
                    final_games.append({
                        "team": label,
                        "opponent": g.get("opponent") or g.get("matchup", ""),
                        "score": score,
                        "result": g.get("result"),
                    })

        result["sports"] = {
            "available": True,
            "live": live_games,
            "upcoming": upcoming_games,
            "finals": final_games,
        }
    except Exception:
        result["sports"] = {"available": False}

    # ── Gaming ───────────────────────────────────────────────────────────────
    try:
        gd = _gaming_cache["data"]
        if gd and gd.get("available"):
            fn = gd.get("fortnite", {})
            news = fn.get("news") or []
            result["gaming"] = {
                "available": True,
                "fortnite_status": fn.get("status"),
                "headline": news[0]["title"] if news else None,
            }
        else:
            result["gaming"] = {"available": False}
    except Exception:
        result["gaming"] = {"available": False}

    # ── Jellyfin / Media ─────────────────────────────────────────────────────
    try:
        jd = _jellyfin_cache["data"]
        if jd and jd.get("available"):
            result["media"] = {
                "available": True,
                "recently_added": (jd.get("recently_added") or [])[:3],
                "continue_watching": (jd.get("continue_watching") or [])[:2],
            }
        else:
            result["media"] = {"available": False}
    except Exception:
        result["media"] = {"available": False}

    result["calendar"] = {
        "available": False,
        "note": "Calendar — coming soon",
    }

    return result


# ─── Dashboard ───────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    now = datetime.now(DENVER)
    return templates.TemplateResponse("index.html", {
        "request": request,
        "time": now.strftime("%-I:%M %p"),
        "date": now.strftime("%A, %B %-d, %Y"),
    })
