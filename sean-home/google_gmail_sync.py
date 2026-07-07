"""
Gmail readonly sync for Sean Home.

Auth is handled by google_auth.py (shared with Calendar).
Run once to authenticate (covers both Calendar + Gmail scopes):
    python3 google_auth.py auth

/api/gmail calls fetch_gmail_summary() — no tokens printed, no full bodies returned.
"""

import json
import sys

PLACEHOLDER = {
    "source": "placeholder",
    "unread_count": 0,
    "important": [],
    "error": None,
}

# Max messages to surface in the card
_MSG_LIMIT = 5


def _parse_address(raw):
    """Extract a display name from a From header like 'Mike Jones <mike@example.com>'."""
    if not raw:
        return ""
    if "<" in raw:
        name = raw.split("<")[0].strip().strip('"')
        return name if name else raw.split("<")[1].rstrip(">")
    return raw.split("@")[0] if "@" in raw else raw


def _get_header(headers, name):
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def fetch_gmail_summary():
    """
    Return unread count + up to 5 important/recent unread message summaries.
    Snippet is Gmail's own short excerpt — no full body, no sensitive content printed.
    """
    try:
        from google_auth import load_creds
    except ImportError:
        return PLACEHOLDER.copy()

    creds = load_creds()
    if creds is None:
        return PLACEHOLDER.copy()

    try:
        from googleapiclient.discovery import build

        service = build("gmail", "v1", credentials=creds, cache_discovery=False)

        # Total unread in inbox
        profile = service.users().labels().get(userId="me", id="INBOX").execute()
        unread_count = profile.get("messagesUnread", 0)

        # Fetch recent unread — try important first, fall back to all unread
        for query in ("is:unread is:important newer_than:14d",
                      "is:unread newer_than:14d"):
            res = service.users().messages().list(
                userId="me",
                q=query,
                maxResults=_MSG_LIMIT,
            ).execute()
            msgs = res.get("messages", [])
            if msgs:
                break

        important = []
        for m in msgs:
            detail = service.users().messages().get(
                userId="me",
                id=m["id"],
                format="metadata",
                metadataHeaders=["From", "Subject"],
            ).execute()
            headers = detail.get("payload", {}).get("headers", [])
            snippet = detail.get("snippet", "")[:120]
            important.append({
                "from": _parse_address(_get_header(headers, "From")),
                "subject": _get_header(headers, "Subject"),
                "snippet": snippet,
            })

        return {
            "source": "google",
            "unread_count": unread_count,
            "important": important,
            "error": None,
        }

    except Exception as exc:
        return {
            "source": "error",
            "unread_count": 0,
            "important": [],
            "error": str(exc),
        }


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "auth":
        print("Auth is now handled by google_auth.py. Run:")
        print("  python3 google_auth.py auth")
        sys.exit(0)
    result = fetch_gmail_summary()
    # Never print the full result — only safe fields
    print(f"source: {result['source']}")
    print(f"unread_count: {result['unread_count']}")
    for m in result.get("important", []):
        print(f"  {m['from']} · {m['subject']}")
    if result.get("error"):
        print(f"error: {result['error']}")
