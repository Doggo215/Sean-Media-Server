#!/bin/bash
# Sean Home — Kiosk mode installer
# Run once on the Raspberry Pi as the 'sean' user.
# Idempotent — safe to re-run after updates.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KIOSK_SCRIPT="/home/sean/kiosk.sh"
LABWC_DIR="$HOME/.config/labwc"
AUTOSTART="$LABWC_DIR/autostart"
RC_XML="$LABWC_DIR/rc.xml"

echo "[kiosk] Installing Sean Home kiosk mode..."

# ── 1. Install unclutter ──────────────────────────────────────────────────────
if ! dpkg -l | grep -qE '^ii\s+unclutter\s'; then
    echo "[kiosk] Installing unclutter..."
    sudo apt-get install -y unclutter -q
else
    echo "[kiosk] unclutter already installed"
fi

# ── 2. Install kiosk.sh ───────────────────────────────────────────────────────
echo "[kiosk] Copying kiosk.sh to $KIOSK_SCRIPT..."
cp "$SCRIPT_DIR/kiosk.sh" "$KIOSK_SCRIPT"
chmod +x "$KIOSK_SCRIPT"

# ── 3. Configure labwc cursor hide-timeout ────────────────────────────────────
mkdir -p "$LABWC_DIR"
if [ ! -f "$RC_XML" ]; then
    echo "[kiosk] Installing labwc rc.xml (cursor hide-timeout 1s)..."
    cp "$SCRIPT_DIR/labwc-rc.xml" "$RC_XML"
else
    echo "[kiosk] rc.xml already exists — not overwriting (review manually if needed)"
fi

# ── 4. Add kiosk.sh to labwc autostart ───────────────────────────────────────
mkdir -p "$LABWC_DIR"
if [ ! -f "$AUTOSTART" ] || ! grep -q "kiosk.sh" "$AUTOSTART"; then
    echo "[kiosk] Adding kiosk.sh to labwc autostart..."
    echo "/home/sean/kiosk.sh &" >> "$AUTOSTART"
else
    echo "[kiosk] kiosk.sh already in labwc autostart"
fi

echo ""
echo "[kiosk] Installation complete."
echo "[kiosk] Sean Home kiosk will launch on next boot."
echo ""
echo "[kiosk] To start immediately (without rebooting):"
echo "         /home/sean/kiosk.sh &"
echo ""
echo "[kiosk] To watch kiosk logs:"
echo "         journalctl -t sean-kiosk -f"
