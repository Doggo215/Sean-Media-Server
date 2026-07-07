#!/usr/bin/env python3
"""
Standalone PSN friends presence test — Phase 2A.

Loads PSN_NPSSO from environment or .env file.
Never prints the token value.
Run from repo root:
  python sean-home/scripts/test_psn_friends.py
"""

import os
import sys
from pathlib import Path


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        if key.strip() and key.strip() not in os.environ:
            os.environ[key.strip()] = val.strip()


# Load .env from project root (sean-home/.env)
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path)

NPSSO = os.environ.get("PSN_NPSSO", "").strip()

if not NPSSO:
    print("ERROR: PSN_NPSSO is not set.")
    print("  1. Log into playstation.com")
    print("  2. DevTools → Application → Cookies → www.playstation.com")
    print("  3. Copy the 'npsso' cookie value")
    print("  4. Add PSN_NPSSO=<value> to sean-home/.env")
    sys.exit(1)

# Redact token in all output — show only first 4 chars for confirmation
_safe_token = NPSSO[:4] + "..." + NPSSO[-4:]
print(f"NPSSO loaded: {_safe_token} (redacted, len={len(NPSSO)})")

try:
    from psnawp_api import PSNAWP
except ImportError:
    print("ERROR: PSNAWP not installed. Run: pip install PSNAWP")
    sys.exit(1)

print("\n── Authenticating with PSN ──────────────────────────────")
try:
    psnawp = PSNAWP(NPSSO)
    me = psnawp.me()
    print(f"Authenticated as: {me.online_id}")
except Exception as e:
    # Redact token from error message just in case
    msg = str(e).replace(NPSSO, "[REDACTED]")
    print(f"ERROR: Authentication failed — {msg}")
    sys.exit(1)

print("\n── Fetching friends list ────────────────────────────────")
try:
    friends_list = list(me.friends_list())
    print(f"Total friends returned: {len(friends_list)}")
except Exception as e:
    msg = str(e).replace(NPSSO, "[REDACTED]")
    print(f"ERROR: Could not fetch friends list — {msg}")
    sys.exit(1)

print("\n── Fetching presence for each friend ───────────────────")
print("(This may take a few seconds)\n")

online = []
errors = []

for friend in friends_list:
    try:
        presence = friend.get_presence()
        status = presence.get("basicPresence", {}).get("availability", "unknown")
        game_title = None
        platform = None

        # Dig into gameTitleInfoList for current game
        titles = presence.get("basicPresence", {}).get("gameTitleInfoList", [])
        if titles:
            game_title = titles[0].get("titleName")
            np_title_id = titles[0].get("npTitleId", "")
            # Platform inference from title ID prefix (PPSA = PS5, CUSA = PS4)
            if np_title_id.startswith("PPSA"):
                platform = "PS5"
            elif np_title_id.startswith("CUSA"):
                platform = "PS4"

        if status in ("availableToPlay", "availableToCommunicate", "busy", "online"):
            online.append({
                "name": friend.online_id,
                "status": status,
                "game": game_title,
                "platform": platform,
            })
    except Exception as e:
        msg = str(e).replace(NPSSO, "[REDACTED]")
        errors.append(f"{friend.online_id}: {msg}")

print(f"Online friends: {len(online)} / {len(friends_list)}")

if online:
    print("\nTop online friends (up to 5):")
    for f in online[:5]:
        game_str = f["game"] or "No game info"
        plat_str = f["platform"] or "unknown platform"
        print(f"  {f['name']} · {f['status']} · {game_str} · {plat_str}")
else:
    print("No friends currently online (or presence not available).")

if errors:
    print(f"\nPresence fetch errors ({len(errors)} friends):")
    for e in errors[:5]:
        print(f"  {e}")

print("\n── Raw presence sample (first online friend) ───────────")
if online:
    # Re-fetch one friend to show raw fields for Phase 2B design
    sample_id = online[0]["name"]
    try:
        sample_user = psnawp.user(online_id=sample_id)
        raw = sample_user.get_presence()
        # Print only basicPresence keys — never token data
        bp = raw.get("basicPresence", {})
        print(f"basicPresence keys: {list(bp.keys())}")
        print(f"availability: {bp.get('availability')}")
        print(f"primaryPlatformInfo: {bp.get('primaryPlatformInfo')}")
        print(f"gameTitleInfoList: {bp.get('gameTitleInfoList')}")
        print(f"lastAvailableDate: {bp.get('lastAvailableDate')}")
    except Exception as e:
        msg = str(e).replace(NPSSO, "[REDACTED]")
        print(f"Could not fetch raw sample: {msg}")
else:
    print("(no online friends to sample)")

print("\n── Done ─────────────────────────────────────────────────")
