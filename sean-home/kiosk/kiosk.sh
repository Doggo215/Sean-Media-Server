#!/bin/bash
# Sean Home — Kiosk browser launcher
#
# Called by ~/.config/labwc/autostart inside the labwc Wayland session,
# so WAYLAND_DISPLAY and XDG_RUNTIME_DIR are already set correctly.
#
# Waits for Sean Home to be healthy, then runs Chromium in a restart loop
# so the dashboard auto-recovers if Chromium ever exits or crashes.

HEALTH_URL="http://localhost:8088/health"
KIOSK_URL="http://localhost:8088"
MAX_WAIT_SERVICE=120   # seconds to wait for systemd service to become active
MAX_WAIT_HTTP=60       # seconds to wait for HTTP /health to respond

log() {
    local msg="[$(date '+%H:%M:%S')] [kiosk] $*"
    echo "$msg"
    echo "$msg" | systemd-cat -t sean-kiosk 2>/dev/null || true
}

log "Starting — waiting for sean-home.service..."

# Step 1: Wait for the systemd service unit to become active
elapsed=0
while ! systemctl is-active --quiet sean-home 2>/dev/null; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [[ $elapsed -ge $MAX_WAIT_SERVICE ]]; then
        log "Timed out waiting for sean-home.service — continuing anyway"
        break
    fi
done

# Step 2: Wait for the HTTP health endpoint to respond
log "sean-home.service active — waiting for HTTP health check..."
elapsed=0
while ! curl -sf "$HEALTH_URL" >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [[ $elapsed -ge $MAX_WAIT_HTTP ]]; then
        log "HTTP health check timed out — launching anyway"
        break
    fi
done

log "Sean Home ready at $KIOSK_URL — launching Chromium kiosk"

# Hide X11 cursor via XWayland (best-effort; cursor theme handles Wayland side)
unclutter -idle 0.5 -root -display :0 >/dev/null 2>&1 &

# Chromium kiosk restart loop
# If Chromium exits for any reason, wait 5 seconds and relaunch.
while true; do
    chromium \
        --kiosk \
        --noerrdialogs \
        --disable-infobars \
        --no-first-run \
        --disable-session-crashed-bubble \
        --disable-restore-session-state \
        --disable-translate \
        --no-default-browser-check \
        --overscroll-history-navigation=0 \
        --password-store=basic \
        --ozone-platform=wayland \
        "$KIOSK_URL" 2>/dev/null

    EXIT_CODE=$?
    log "Chromium exited (code $EXIT_CODE) — restarting in 5 seconds..."
    sleep 5

    # Re-verify Sean Home is still healthy before restarting
    until curl -sf "$HEALTH_URL" >/dev/null 2>&1; do
        log "Sean Home not responding — waiting..."
        sleep 3
    done
done
