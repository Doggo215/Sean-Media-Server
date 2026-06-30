#!/bin/bash
# Media Drop — Installation Script
# Run once to install dependencies and start the service.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.sean.mediadrop.plist"
LOG_DIR="$HOME/Library/Logs/MediaDrop"

echo "=============================="
echo "  Media Drop — Install"
echo "=============================="
echo ""

# Install Python dependencies
echo "[1/3] Installing Python dependencies..."
pip3 install -r "$SCRIPT_DIR/requirements.txt" --quiet
echo "Dependencies installed."

# Create log directory
echo "[2/3] Creating log directory..."
mkdir -p "$LOG_DIR"
echo "Log directory: $LOG_DIR"

# Load Launch Agent
echo "[3/3] Loading Launch Agent..."
if launchctl list | grep -q "com.sean.mediadrop"; then
  echo "Service already loaded — reloading..."
  launchctl unload "$PLIST" 2>/dev/null || true
fi
launchctl load "$PLIST"
echo "Service loaded."

echo ""
echo "=============================="
echo "Media Drop is running."
echo ""
echo "Drop folders:  ~/Desktop/Media Drop/"
echo "Log file:      $LOG_DIR/media_drop.log"
echo "Plist:         $PLIST"
echo ""
echo "To check status:  launchctl list | grep mediadrop"
echo "To stop:          launchctl unload $PLIST"
echo "To restart:       launchctl unload $PLIST && launchctl load $PLIST"
echo "=============================="
