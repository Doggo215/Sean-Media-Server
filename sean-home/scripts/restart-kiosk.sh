#!/usr/bin/env bash
# Sean Home — kiosk restart helper
#
# Usage: ./restart-kiosk.sh
#
# kiosk.sh (at /home/sean/kiosk.sh) runs Chromium in a while-true loop.
# Killing the Chromium process is sufficient — the loop relaunches it in ~5s.
#
# For visual deployments (JS/CSS/HTML changes):
#   1. scp changed files to Pi
#   2. sudo systemctl restart sean-home
#   3. Confirm served version strings: curl -s http://localhost:8088/ | grep -E 'dashboard|style'
#   4. Run this script to force-reload the kiosk
#   5. Wait ~10s, then capture a screenshot to confirm

set -euo pipefail

LOG_FILE="/tmp/sean-home-kiosk-restart.log"

echo "[$(date -Is)] Restarting Sean Home kiosk" > "$LOG_FILE"

# Kill only the kiosk Chromium instance (matched by its URL arg).
# Falls back to any chromium process if the specific match fails.
if pgrep -af "chromium.*localhost:8088" >> "$LOG_FILE" 2>&1; then
    echo "[$(date -Is)] Killing chromium (matched localhost:8088)..." >> "$LOG_FILE"
    pkill -f "chromium.*localhost:8088" || true
else
    echo "[$(date -Is)] No specific match — falling back to pkill chromium" >> "$LOG_FILE"
    pkill -f chromium || true
fi

# kiosk.sh restart loop fires automatically after ~5s.
# Wait a bit longer to let it fully initialize before checking.
sleep 8

echo "[$(date -Is)] Chromium processes after restart:" >> "$LOG_FILE"
pgrep -af chromium >> "$LOG_FILE" 2>&1 || echo "(none found)" >> "$LOG_FILE"

echo "[$(date -Is)] Done. Check log: $LOG_FILE"
cat "$LOG_FILE"
