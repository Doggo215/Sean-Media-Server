"""
Google Calendar sync for Sean Home.

Run once to authenticate:
    python3 google_calendar_sync.py auth

After that, /api/calendar calls fetch_calendar_events() without needing a browser.

Credential files (never committed — gitignored):
    sean-home/credentials.json   OAuth client secret from Google Cloud Console
    sean-home/token.json         Access/refresh token written after first auth
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

MOUNTAIN = ZoneInfo("America/Denver")
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

# Credential paths — checked in order so both Pi and local dev work
_HERE = Path(__file__).parent
CRED_PATHS = [
    Path("/home/sean/sean-home/credentials.json"),
    _HERE / "credentials.json",
]
TOKEN_PATHS = [
    Path("/home/sean/sean-home/token.json"),
    _HERE / "token.json",
]

PLACEHOLDER = {
    "source": "placeholder",
    "next_event": None,
    "events_today": [],
    "events_tomorrow": [],
    "error": None,
}


def _find(paths):
    for p in paths:
        if p.exists():
            return p
    return None


def _token_path():
    cred = _find(CRED_PATHS)
    if cred:
        return cred.parent / "token.json"
    return TOKEN_PATHS[0]


def _load_creds():
    """Load and refresh Google credentials. Returns None if not available."""
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request

        token_file = _find(TOKEN_PATHS)
        if not token_file:
            return None

        creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)

        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            # Save refreshed token (token contents are not printed)
            token_file.write_text(creds.to_json())

        if not creds.valid:
            return None

        return creds

    except Exception:
        return None


def _fmt_time(dt_str, all_day=False):
    """Parse an ISO datetime string and format as '3:00 PM'."""
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
    creds = _load_creds()
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

        # Next event = first future event today (skip all-day and already-past)
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


# ── CLI auth bootstrap ──────────────────────────────────────────────────────
def run_auth():
    """
    One-time OAuth flow. Run on the Pi:
        python3 google_calendar_sync.py auth
    Writes token.json next to credentials.json. Do not share that file.
    """
    cred_file = _find(CRED_PATHS)
    if not cred_file:
        print("ERROR: credentials.json not found. Copy it from Google Cloud Console.")
        print("  Expected at one of:")
        for p in CRED_PATHS:
            print(f"    {p}")
        sys.exit(1)

    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_secrets_file(str(cred_file), SCOPES)
    # run_console() prints a URL — open it in your browser, paste the code back
    creds = flow.run_console()

    token_file = cred_file.parent / "token.json"
    token_file.write_text(creds.to_json())
    print(f"token.json saved to {token_file}")
    print("Auth complete. Restart sean-home.service.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "auth":
        run_auth()
    else:
        result = fetch_calendar_events()
        # Print safe subset — never print token fields
        safe = {k: v for k, v in result.items() if k != "error" or v}
        print(json.dumps(safe, indent=2, default=str))
