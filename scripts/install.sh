#!/bin/bash
# Sean Media Server — Full Installation Script
# Run on a fresh Raspberry Pi OS (Debian Trixie) install
# Usage: sudo bash install.sh

set -e

echo "=============================="
echo "  Sean Media Server — Install"
echo "=============================="
echo ""

if [ "$(id -u)" != "0" ]; then
  echo "Run as root: sudo bash install.sh"
  exit 1
fi

# Update system
echo "[1/5] Updating system packages..."
apt update && DEBIAN_FRONTEND=noninteractive apt upgrade -y

# Create media directory structure
echo "[2/5] Creating media directory structure..."
mkdir -p /srv/media/{movies,tv,kids,documentaries,sports,home-videos,family-photos,christmas,music,audiobooks,metadata,downloads,staging}
chown -R jellyfin:jellyfin /srv/media 2>/dev/null || true
chmod -R 755 /srv/media
chmod 775 /srv/media/downloads /srv/media/staging

# Add Jellyfin repository
echo "[3/5] Adding Jellyfin repository..."
curl -fsSL https://repo.jellyfin.org/jellyfin_team.gpg.key | gpg --dearmor -o /usr/share/keyrings/jellyfin.gpg
echo "deb [signed-by=/usr/share/keyrings/jellyfin.gpg] https://repo.jellyfin.org/debian trixie main" > /etc/apt/sources.list.d/jellyfin.list
apt update

# Install Jellyfin
echo "[4/5] Installing Jellyfin..."
DEBIAN_FRONTEND=noninteractive apt install -y jellyfin

# Set ownership after Jellyfin creates its user
chown -R jellyfin:jellyfin /srv/media

# Enable and start Jellyfin
echo "[5/5] Enabling Jellyfin service..."
systemctl enable jellyfin
systemctl start jellyfin

echo ""
echo "=============================="
echo "Installation complete."
echo ""
echo "Jellyfin is running at:"
echo "  http://$(hostname -I | awk '{print $1}'):8096"
echo ""
echo "Complete the first-run wizard in your browser."
echo "Then run: bash scripts/health-check.sh"
echo "=============================="
