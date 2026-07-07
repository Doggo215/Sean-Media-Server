"""
Shared Google OAuth helper for Sean Home.

Both google_calendar_sync.py and google_gmail_sync.py import from here.
One token.json covers all scopes — re-run auth if scopes change.

Credential files (gitignored — never commit):
    sean-home/credentials.json   OAuth client ID from Google Cloud Console
    sean-home/token.json         Written after first auth run
"""

import sys
from pathlib import Path

# Combined scopes — all Google features Sean Home uses
SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
]

_HERE = Path(__file__).parent

CRED_PATHS = [
    Path("/home/sean/sean-home/credentials.json"),
    _HERE / "credentials.json",
]
TOKEN_PATHS = [
    Path("/home/sean/sean-home/token.json"),
    _HERE / "token.json",
]


def _find(paths):
    for p in paths:
        if p.exists():
            return p
    return None


def load_creds():
    """
    Load and if needed refresh Google OAuth credentials.
    Returns a valid Credentials object, or None if not available.
    Never prints token values.
    """
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request

        token_file = _find(TOKEN_PATHS)
        if not token_file:
            return None

        creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)

        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            token_file.write_text(creds.to_json())

        return creds if creds.valid else None

    except Exception:
        return None


def run_auth():
    """
    One-time OAuth flow. Run on the Pi:
        python3 google_auth.py auth

    Writes token.json with both Calendar and Gmail scopes.
    Do not share or commit token.json.
    """
    cred_file = _find(CRED_PATHS)
    if not cred_file:
        print("ERROR: credentials.json not found.")
        print("Expected at one of:")
        for p in CRED_PATHS:
            print(f"  {p}")
        sys.exit(1)

    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_secrets_file(str(cred_file), SCOPES)
    flow.redirect_uri = "urn:ietf:wg:oauth:2.0:oob"

    # Call the underlying OAuth2 session directly to skip PKCE (code_challenge).
    # PKCE ties the code to a specific flow instance; without it the code can be
    # exchanged in any single run without a matching verifier.
    auth_url, _ = flow.oauth2session.authorization_url(
        flow.client_config["auth_uri"],
        access_type="offline",
        prompt="consent",
    )

    print("\n── Google Auth ─────────────────────────────────────────")
    print("Open this URL in your browser:")
    print(f"\n  {auth_url}\n")
    print("After approving, Google will show you an authorization code.")
    print("────────────────────────────────────────────────────────")
    code = input("Paste the authorization code here: ").strip()

    flow.fetch_token(code=code)
    creds = flow.credentials

    token_file = cred_file.parent / "token.json"
    token_file.write_text(creds.to_json())
    print(f"\ntoken.json saved to {token_file}")
    print("Auth complete — both Calendar and Gmail scopes granted.")
    print("Restart sean-home.service to apply.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "auth":
        run_auth()
    else:
        print("Usage: python3 google_auth.py auth")
