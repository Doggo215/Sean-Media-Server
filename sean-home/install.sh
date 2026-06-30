#!/bin/bash
# Sean Home — install/update script. Run on the Pi from /home/sean/sean-home.
# Safe to re-run — does not touch Jellyfin, Samba, Media Drop, or backups.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "[1/4] Creating virtualenv..."
if [ ! -d venv ]; then
  python3 -m venv venv
fi

echo "[2/4] Installing dependencies..."
./venv/bin/pip install --quiet --upgrade pip
./venv/bin/pip install --quiet -r requirements.txt

echo "[3/4] Installing systemd service..."
sudo cp sean-home.service /etc/systemd/system/sean-home.service
sudo systemctl daemon-reload
sudo systemctl enable sean-home

echo "[4/4] Starting service..."
sudo systemctl restart sean-home
sleep 2
sudo systemctl status sean-home --no-pager | head -10

echo ""
echo "Sean Home installed. Visit http://$(hostname -I | awk '{print $1}'):8088"
