#!/bin/bash
# Sean Media Server — Restore
# Restores a complete Media Server from a backup archive.
#
# Usage:
#   bash restore.sh /path/to/backup.tar.gz   — restore from weekly archive
#   bash restore.sh /path/to/backup-dir/     — restore from daily directory
#
# This script must be run from your Mac.
# It will SSH into the Pi and restore all configuration.
# Media files are NOT touched — they remain on /srv/media.

set -euo pipefail

PI_HOST="${PI_HOST:-10.0.0.226}"
PI_USER="${PI_USER:-sean}"
PI="$PI_USER@$PI_HOST"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${1:-}" ]; then
  echo "Usage: bash restore.sh <backup.tar.gz or backup-directory>"
  exit 1
fi

SOURCE="$1"
WORK_DIR="/tmp/media-server-restore-$$"

echo ""
echo "══════════════════════════════════════════"
echo "  Sean Media Server — Restore"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════"
echo ""
echo "  Source: $SOURCE"
echo "  Target: $PI"
echo ""
echo "  ⚠️  WARNING: This will overwrite Jellyfin and Samba"
echo "  configuration on the target Pi."
echo "  Media files will NOT be touched."
echo ""
read -p "  Proceed? (yes/N): " CONFIRM
[ "$CONFIRM" = "yes" ] || { echo "Cancelled."; exit 0; }

# ─── Prepare backup directory ────────────────────────────────────────────────

if [[ "$SOURCE" == *.tar.gz ]]; then
  echo ""
  echo "[ Extracting archive... ]"
  mkdir -p "$WORK_DIR"
  tar -xzf "$SOURCE" -C "$WORK_DIR"
  BACKUP_DIR=$(ls -d "$WORK_DIR"/*/  | head -1)
else
  BACKUP_DIR="$SOURCE"
fi

echo "  Backup directory: $BACKUP_DIR"

# Show backup info
if [ -f "$BACKUP_DIR/BACKUP_INFO.txt" ]; then
  echo ""
  cat "$BACKUP_DIR/BACKUP_INFO.txt" | sed 's/^/  /'
  echo ""
fi

# ─── Verify Pi is reachable ──────────────────────────────────────────────────

echo "[ Connectivity ]"
if ! ssh -o ConnectTimeout=8 -o BatchMode=yes "$PI" "exit" 2>/dev/null; then
  echo "  ❌ Cannot reach $PI"
  exit 1
fi
echo "  ✅ SSH connected"

# ─── Install required packages ───────────────────────────────────────────────

echo ""
echo "[ Step 1/6 ] Installing required packages..."

ssh "$PI" "sudo apt update -q && sudo DEBIAN_FRONTEND=noninteractive apt install -y samba" 2>&1 | grep -E '(Installing|Setting up|already)' | head -5 || true

# Add Jellyfin repo if not present
HAS_JELLYFIN=$(ssh "$PI" "dpkg -l jellyfin 2>/dev/null | grep '^ii' | wc -l")
if [ "$HAS_JELLYFIN" -eq 0 ]; then
  echo "  Jellyfin not installed — installing from official repo..."
  if [ -f "$BACKUP_DIR/system/apt/jellyfin.list" ]; then
    scp "$BACKUP_DIR/system/apt/jellyfin.list" "${PI}:/tmp/jellyfin.list"
    ssh "$PI" "sudo cp /tmp/jellyfin.list /etc/apt/sources.list.d/ && \
      curl -fsSL https://repo.jellyfin.org/jellyfin_team.gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/jellyfin.gpg && \
      sudo apt update -q && sudo DEBIAN_FRONTEND=noninteractive apt install -y jellyfin"
  fi
fi
echo "  ✅ Packages ready"

# ─── Restore Samba ───────────────────────────────────────────────────────────

echo ""
echo "[ Step 2/6 ] Restoring Samba configuration..."
if [ -f "$BACKUP_DIR/samba/smb.conf" ]; then
  scp "$BACKUP_DIR/samba/smb.conf" "${PI}:/tmp/smb.conf"
  ssh "$PI" "sudo cp /tmp/smb.conf /etc/samba/smb.conf && sudo systemctl restart smbd nmbd"
  echo "  ✅ smb.conf restored"
else
  echo "  ⚠️  No smb.conf in backup — skipping"
fi

# ─── Restore Jellyfin ────────────────────────────────────────────────────────

echo ""
echo "[ Step 3/6 ] Restoring Jellyfin..."

ssh "$PI" "sudo systemctl stop jellyfin" 2>/dev/null || true

if [ -d "$BACKUP_DIR/jellyfin/config" ]; then
  rsync -a --rsync-path="sudo rsync" "$BACKUP_DIR/jellyfin/config/" "${PI}:/etc/jellyfin/"
  echo "  ✅ Jellyfin config restored"
fi

if [ -d "$BACKUP_DIR/jellyfin/data" ]; then
  rsync -a --rsync-path="sudo rsync" "$BACKUP_DIR/jellyfin/data/" "${PI}:/var/lib/jellyfin/"
  echo "  ✅ Jellyfin data restored (database, metadata, users, watch history)"
fi

ssh "$PI" "sudo chown -R jellyfin:jellyfin /etc/jellyfin /var/lib/jellyfin 2>/dev/null || true"
ssh "$PI" "sudo systemctl start jellyfin"
echo "  ✅ Jellyfin restarted"

# ─── Restore /srv/media structure ────────────────────────────────────────────

echo ""
echo "[ Step 4/6 ] Verifying /srv/media structure..."

ssh "$PI" "
  sudo mkdir -p /srv/media/{movies,tv,kids,documentaries,sports,home-videos,family-photos,christmas,music,audiobooks,metadata,downloads,staging}
  sudo chown -R jellyfin:jellyfin /srv/media
  sudo chmod -R 775 /srv/media
  id sean | grep -q jellyfin || sudo usermod -aG jellyfin sean
"
echo "  ✅ /srv/media structure verified"

# ─── Restore Media Drop ──────────────────────────────────────────────────────

echo ""
echo "[ Step 5/6 ] Restoring Media Drop..."

MD_BACKUP="$BACKUP_DIR/media-drop"
if [ -d "$MD_BACKUP/media-drop" ]; then
  SCRIPT_DEST="$HOME/Desktop/Sean-Media-Server/scripts/media-drop"
  mkdir -p "$SCRIPT_DEST"
  cp -r "$MD_BACKUP/media-drop/." "$SCRIPT_DEST/"
  echo "  ✅ Media Drop scripts restored"
fi

if [ -f "$MD_BACKUP/launch-agent/com.sean.mediadrop.plist" ]; then
  cp "$MD_BACKUP/launch-agent/com.sean.mediadrop.plist" \
     "$HOME/Library/LaunchAgents/"
  launchctl unload "$HOME/Library/LaunchAgents/com.sean.mediadrop.plist" 2>/dev/null || true
  launchctl load "$HOME/Library/LaunchAgents/com.sean.mediadrop.plist"
  echo "  ✅ Launch Agent restored and reloaded"
fi

mkdir -p "$HOME/Desktop/Media Drop"/{Movies,"TV Shows",Kids,Documentaries,Sports,"Home Videos","Family Photos",Christmas,Music,Audiobooks,Unknown,Failed}
echo "  ✅ Media Drop folders verified"

# ─── Health check ────────────────────────────────────────────────────────────

echo ""
echo "[ Step 6/6 ] Running health check..."
sleep 5  # Give Jellyfin time to start
bash "$SCRIPT_DIR/health-check.sh"

# ─── Cleanup ─────────────────────────────────────────────────────────────────

[ -d "$WORK_DIR" ] && rm -rf "$WORK_DIR"

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Restore complete"
echo ""
echo "  Verify manually:"
echo "    Browser:    http://$PI_HOST:8096"
echo "    Shares:     smb://media-server.local/media"
echo "    Android TV: open Jellyfin app"
echo "══════════════════════════════════════════"
echo ""
