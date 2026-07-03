#!/bin/bash
# Sean Home — Hardened Kiosk Browser Launcher
# Runs inside the labwc Wayland session via ~/.config/labwc/autostart
# Uses a dedicated Chromium profile to prevent session restore prompts

HEALTH_URL="http://localhost:8088/health"
KIOSK_URL="http://localhost:8088"
PROFILE_DIR="$HOME/.config/sean-home-kiosk/chromium"
MAX_WAIT_SERVICE=120
MAX_WAIT_HTTP=60

log() {
    local msg="[$(date '+%H:%M:%S')] $*"
    echo "$msg"
    echo "$msg" | systemd-cat -t sean-kiosk 2>/dev/null || true
}

log "Kiosk starting — waiting for sean-home.service..."

# Step 1: Wait for systemd service to become active
elapsed=0
while ! systemctl is-active --quiet sean-home 2>/dev/null; do
    sleep 2
    elapsed=$((elapsed + 2))
    if [[ $elapsed -ge $MAX_WAIT_SERVICE ]]; then
        log "Timed out waiting for sean-home.service — continuing anyway"
        break
    fi
done

# Step 2: Wait for HTTP health endpoint
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

log "Sean Home ready — launching Chromium kiosk"

# Prepare dedicated profile directory
mkdir -p "$PROFILE_DIR/Default"

# Clear crash and session state from previous run to prevent restore prompts
rm -f "$PROFILE_DIR/Default/Last Session" 2>/dev/null || true
rm -f "$PROFILE_DIR/Default/Last Tabs" 2>/dev/null || true
find "$PROFILE_DIR/Default/Sessions" -type f -delete 2>/dev/null || true
find "$PROFILE_DIR/Crash Reports" -type f -delete 2>/dev/null || true

# Clear disk cache so version-bumped JS/CSS is always fetched fresh
rm -rf "$PROFILE_DIR/Default/Cache" 2>/dev/null || true
rm -rf "$PROFILE_DIR/Default/Code Cache" 2>/dev/null || true

# Seed Preferences to disable session restore if not already present
PREFS="$PROFILE_DIR/Default/Preferences"
if [[ ! -f "$PREFS" ]]; then
    echo '{"profile":{"exit_type":"Normal","exited_cleanly":true},"session":{"restore_on_startup":5}}' > "$PREFS"
fi

# Hide cursor (best-effort, may not be installed)
unclutter -idle 0.5 -root -display :0 >/dev/null 2>&1 &

# Chromium kiosk restart loop
CRASH_COUNT=0
while true; do
    log "Launching Chromium (run #$((CRASH_COUNT + 1)))..."

    chromium \
        --user-data-dir="$PROFILE_DIR" \
        --kiosk \
        --noerrdialogs \
        --disable-infobars \
        --no-first-run \
        --disable-session-crashed-bubble \
        --disable-restore-session-state \
        --disable-translate \
        --disable-features=TranslateUI \
        --no-default-browser-check \
        --check-for-update-interval=31536000 \
        --overscroll-history-navigation=0 \
        --disable-pinch \
        --autoplay-policy=no-user-gesture-required \
        --password-store=basic \
        --ozone-platform=wayland \
        --disk-cache-size=1 \
        --media-cache-size=1 \
        --disable-application-cache \
        "$KIOSK_URL" 2>/dev/null

    EXIT_CODE=$?
    CRASH_COUNT=$((CRASH_COUNT + 1))
    log "Chromium exited (code $EXIT_CODE, crash #$CRASH_COUNT) — restarting in 2 seconds..."
    sleep 2

    # Clear session state before restart to prevent restore prompt
    rm -f "$PROFILE_DIR/Default/Last Session" 2>/dev/null || true
    rm -f "$PROFILE_DIR/Default/Last Tabs" 2>/dev/null || true

    # Re-verify Sean Home is still healthy before restarting
    until curl -sf "$HEALTH_URL" >/dev/null 2>&1; do
        log "Sean Home not responding — waiting before restart..."
        sleep 3
    done
done
