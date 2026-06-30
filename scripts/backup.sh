#!/bin/bash
# Sean Media Server — Daily Backup
# Backs up all configuration from the Pi to ~/Backups/MediaServer-Backups/Daily/
# Does NOT back up media files.
#
# Usage:
#   bash backup.sh              — timestamped daily backup
#   bash backup.sh manual       — save to Manual/ instead of Daily/
#
# Run automatically via cron or manually before making changes.

set -euo pipefail

PI="sean@10.0.0.226"
BACKUP_BASE="$HOME/Backups/MediaServer-Backups"
DATE=$(date +%Y-%m-%d_%H%M)
MODE="${1:-daily}"

case "$MODE" in
  manual) DEST="$BACKUP_BASE/Manual/$DATE" ;;
  *)      DEST="$BACKUP_BASE/Daily/$DATE"  ;;
esac

# ─── Helpers ────────────────────────────────────────────────────────────────

PASS=0; WARN=0; FAIL=0
log()  { echo "  $*"; }
ok()   { echo "  ✅ $*"; PASS=$((PASS+1)); }
warn() { echo "  ⚠️  $*"; WARN=$((WARN+1)); }
fail() { echo "  ❌ $*"; FAIL=$((FAIL+1)); }

rsync_from_pi() {
  local src="$1" dest="$2"
  mkdir -p "$dest"
  rsync -a --rsync-path="sudo rsync" "$PI:$src" "$dest" 2>/dev/null && return 0 || return 1
}

# ─── Start ───────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════"
echo "  Sean Media Server — Backup"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════"
echo ""

mkdir -p "$DEST"

# ─── SSH connectivity ────────────────────────────────────────────────────────

echo "[ Connectivity ]"
if ! ssh -o ConnectTimeout=8 -o BatchMode=yes "$PI" "exit" 2>/dev/null; then
  fail "Cannot reach Pi at $PI — aborting backup"
  echo ""
  echo "Backup FAILED — server unreachable."
  exit 1
fi
ok "SSH connected to $PI"

# ─── Jellyfin ────────────────────────────────────────────────────────────────

echo ""
echo "[ Jellyfin ]"

if rsync_from_pi "/etc/jellyfin/" "$DEST/jellyfin/config/"; then
  ok "/etc/jellyfin/"
else
  warn "/etc/jellyfin/ — partial or empty"
fi

if rsync_from_pi "/var/lib/jellyfin/" "$DEST/jellyfin/data/"; then
  ok "/var/lib/jellyfin/ (database, metadata, users, watch history)"
else
  warn "/var/lib/jellyfin/ — partial or empty"
fi

# ─── Samba ───────────────────────────────────────────────────────────────────

echo ""
echo "[ Samba ]"

if rsync_from_pi "/etc/samba/smb.conf" "$DEST/samba/"; then
  ok "/etc/samba/smb.conf"
else
  warn "smb.conf — could not retrieve"
fi

if rsync_from_pi "/etc/samba/smb.conf.backup" "$DEST/samba/"; then
  ok "/etc/samba/smb.conf.backup"
else
  log "No smb.conf.backup found (non-critical)"
fi

# ─── System configuration ────────────────────────────────────────────────────

echo ""
echo "[ System ]"

mkdir -p "$DEST/system"

ssh -o ConnectTimeout=8 "$PI" "
  hostname
  hostnamectl | grep 'Static hostname'
  cat /etc/os-release | grep PRETTY_NAME
  uname -r
  hostname -I
" > "$DEST/system/system-info.txt" 2>/dev/null && ok "System info captured" || warn "System info partial"

ssh -o ConnectTimeout=8 "$PI" "dpkg -l | grep '^ii'" \
  > "$DEST/system/installed-packages.txt" 2>/dev/null && ok "Package list captured" || warn "Package list failed"

if rsync_from_pi "/etc/systemd/system/jellyfin.service" "$DEST/system/services/" 2>/dev/null; then
  ok "jellyfin.service"
fi
# Capture other relevant service files
for svc in panel-os stadium-os; do
  ssh -o ConnectTimeout=5 "$PI" "cat /etc/systemd/system/${svc}.service 2>/dev/null" \
    > "$DEST/system/services/${svc}.service" 2>/dev/null || true
done
ok "Service files captured"

if rsync_from_pi "/etc/hosts" "$DEST/system/"; then
  ok "/etc/hosts"
fi
if rsync_from_pi "/etc/hostname" "$DEST/system/"; then
  ok "/etc/hostname"
fi

ssh -o ConnectTimeout=8 "$PI" "sudo smbpasswd -e sean 2>/dev/null; \
  pdbedit -L -v 2>/dev/null | grep -E '(Account|Full Name|User SID)'" \
  > "$DEST/system/samba-users.txt" 2>/dev/null || true

# Capture /srv/media directory structure (not files — just the tree)
ssh -o ConnectTimeout=8 "$PI" "find /srv/media -type d | sort" \
  > "$DEST/system/media-directory-tree.txt" 2>/dev/null && ok "/srv/media directory tree"

# Capture permission snapshot
ssh -o ConnectTimeout=8 "$PI" "ls -laR /srv/media 2>/dev/null | head -100" \
  > "$DEST/system/media-permissions.txt" 2>/dev/null

# ─── Jellyfin apt repo ───────────────────────────────────────────────────────

if rsync_from_pi "/etc/apt/sources.list.d/jellyfin.list" "$DEST/system/apt/"; then
  ok "Jellyfin apt repo config"
fi

# ─── Media Drop ──────────────────────────────────────────────────────────────

echo ""
echo "[ Media Drop ]"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEDIADROP_SRC="$SCRIPT_DIR/media-drop"
MEDIADROP_DEST="$DEST/media-drop"

if [ -d "$MEDIADROP_SRC" ]; then
  cp -r "$MEDIADROP_SRC" "$MEDIADROP_DEST"
  ok "media-drop scripts"
else
  warn "media-drop directory not found at $MEDIADROP_SRC"
fi

PLIST="$HOME/Library/LaunchAgents/com.sean.mediadrop.plist"
if [ -f "$PLIST" ]; then
  mkdir -p "$MEDIADROP_DEST/launch-agent"
  cp "$PLIST" "$MEDIADROP_DEST/launch-agent/"
  ok "Launch Agent plist"
else
  warn "Launch Agent plist not found"
fi

# Copy recent logs (last 500 lines)
LOG_FILE="$HOME/Library/Logs/MediaDrop/media_drop.log"
if [ -f "$LOG_FILE" ]; then
  mkdir -p "$DEST/logs"
  tail -500 "$LOG_FILE" > "$DEST/logs/media_drop.log"
  ok "Media Drop log (last 500 lines)"
fi

# ─── Project documentation ───────────────────────────────────────────────────

echo ""
echo "[ Documentation ]"

REPO_DIR="$(dirname "$SCRIPT_DIR")"
mkdir -p "$DEST/docs"
for f in README.md PROJECT_CONSTITUTION.md BUILD_LOG.md ROADMAP.md \
          CHANGELOG.md ARCHITECTURE.md NETWORK.md STORAGE.md \
          HARDWARE.md SOFTWARE.md MEDIA_ORGANIZATION.md BACKUP.md \
          TROUBLESHOOTING.md DISASTER_RECOVERY.md TODO.md NOTES.md; do
  src="$REPO_DIR/$f"
  [ -f "$src" ] && cp "$src" "$DEST/docs/" && log "  $f"
done
ok "Documentation backed up"

# ─── Manifest ────────────────────────────────────────────────────────────────

echo ""
echo "[ Finalizing ]"

find "$DEST" -type f | sort > "$DEST/MANIFEST.txt"
FILE_COUNT=$(wc -l < "$DEST/MANIFEST.txt")
BACKUP_SIZE=$(du -sh "$DEST" | cut -f1)

cat > "$DEST/BACKUP_INFO.txt" << EOF
Sean Media Server — Backup
Date: $(date)
Mode: $MODE
Destination: $DEST
Files: $FILE_COUNT
Size: $BACKUP_SIZE
Pi: $PI
Hostname: $(ssh -o ConnectTimeout=5 "$PI" "hostname" 2>/dev/null || echo "unknown")
Jellyfin: $(ssh -o ConnectTimeout=5 "$PI" "dpkg -l jellyfin 2>/dev/null | grep jellyfin | awk '{print \$3}'" 2>/dev/null || echo "unknown")
Passed: $PASS  Warnings: $WARN  Failed: $FAIL
EOF

ok "Manifest written ($FILE_COUNT files, $BACKUP_SIZE)"

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════"
printf "  Results:  ✅ %d passed   ⚠️  %d warnings   ❌ %d failed\n" $PASS $WARN $FAIL
echo "  Location: $DEST"
echo "  Size:     $BACKUP_SIZE"
echo "══════════════════════════════════════════"
echo ""

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
