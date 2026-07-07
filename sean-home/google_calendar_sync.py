"""
Google Calendar sync for Sean Home.

Auth is handled by google_auth.py (shared with Gmail).
Run once to authenticate:
    python3 google_auth.py auth

After that, /api/calendar calls fetch_calendar_events() without needing a browser.
"""

import json
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

MOUNTAIN = ZoneInfo("America/Denver")

PLACEHOLDER = {
    "source": "placeholder",
    "next_event": None,
    "events_today": [],
    "events_tomorrow": [],
    "error": None,
}


def _fmt_time(dt_str, all_day=False):
    if all_day:
        return "All day"
    try:
        dt = datetime.fromisoformat(dt_str)
        dt_mt = dt.astimezone(MOUNTAIN)
        hour = dt_mt.hour % 12 or 12
        minute = dt_mt.strftime("%M")
        ampm = "AM" if dt_mt.hour < 12 else "PM"
        return f"{hour}:{minute} {ampm}"
    except Exception:
        return ""


def _parse_event(event):
    start = event.get("start", {})
    all_day = "date" in start and "dateTime" not in start

    if all_day:
        raw_start = start.get("date", "")
        dt_start = datetime.fromisoformat(raw_start).replace(tzinfo=MOUNTAIN)
    else:
        raw_start = start.get("dateTime", "")
        dt_start = datetime.fromisoformat(raw_start).astimezone(MOUNTAIN)

    return {
        "time": _fmt_time(raw_start, all_day),
        "title": event.get("summary", "Untitled"),
        "location": event.get("location", "") or "",
        "all_day": all_day,
        "_dt": dt_start,
    }


def fetch_calendar_events():
    """Return today's and tomorrow's events in Mountain Time. Safe — no tokens printed."""
    try:
        from google_auth import load_creds
    except ImportError:
        return PLACEHOLDER.copy()

    creds = load_creds()
    if creds is None:
        return PLACEHOLDER.copy()

    try:
        from googleapiclient.discovery import build

        service = build("calendar", "v3", credentials=creds, cache_discovery=False)

        now_mt = datetime.now(MOUNTAIN)
        today_start = now_mt.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_end = today_start + timedelta(days=2)

        result = service.events().list(
            calendarId="primary",
            timeMin=today_start.isoformat(),
            timeMax=tomorrow_end.isoformat(),
            maxResults=20,
            singleEvents=True,
            orderBy="startTime",
        ).execute()

        raw_events = result.get("items", [])
        parsed = [_parse_event(e) for e in raw_events]

        today_str = now_mt.strftime("%Y-%m-%d")
        tomorrow_str = (now_mt + timedelta(days=1)).strftime("%Y-%m-%d")

        events_today = []
        events_tomorrow = []
        for e in parsed:
            day = e["_dt"].strftime("%Y-%m-%d")
            clean = {k: v for k, v in e.items() if k != "_dt"}
            if day == today_str:
                events_today.append(clean)
            elif day == tomorrow_str:
                events_tomorrow.append(clean)

        next_event = None
        for e in parsed:
            if e["_dt"].strftime("%Y-%m-%d") != today_str:
                break
            if e["all_day"]:
                continue
            if e["_dt"] > now_mt:
                next_event = {k: v for k, v in e.items() if k != "_dt"}
                break

        return {
            "source": "google",
            "next_event": next_event,
            "events_today": events_today,
            "events_tomorrow": events_tomorrow,
            "error": None,
        }

    except Exception as exc:
        return {
            "source": "error",
            "next_event": None,
            "events_today": [],
            "events_tomorrow": [],
            "error": str(exc),
        }


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "auth":
        print("Auth is now handled by google_auth.py. Run:")
        print("  python3 google_auth.py auth")
        sys.exit(0)
    result = fetch_calendar_events()
    safe = {k: v for k, v in result.items() if k != "error" or v}
    print(json.dumps(safe, indent=2, default=str))
