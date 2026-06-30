#!/bin/bash
# Sean Media Server — Weekly Backup
# Runs a full daily backup, compresses it, checksums it, and prunes old backups.
#
# Retention policy:
#   Daily backups:  keep 7 days
#   Weekly backups: keep 8 weeks
#
# Usage: bash weekly-backup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_BASE="$HOME/Backups/MediaServer-Backups"
DATE=$(date +%Y-%m-%d)
WEEKLY_DIR="$BACKUP_BASE/Weekly"
ARCHIVE="$WEEKLY_DIR/media-server-backup-${DATE}.tar.gz"
CHECKSUM="$ARCHIVE.sha256"

echo ""
echo "══════════════════════════════════════════"
echo "  Sean Media Server — Weekly Backup"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════"
echo ""

mkdir -p "$WEEKLY_DIR"

# Step 1: Run daily backup
echo "[ Step 1/5 ] Running daily backup..."
bash "$SCRIPT_DIR/backup.sh"
LATEST_DAILY=$(ls -td "$BACKUP_BASE/Daily"/*/ 2>/dev/null | head -1)
echo "  Daily backup: $LATEST_DAILY"

# Step 2: Compress
echo ""
echo "[ Step 2/5 ] Compressing..."
tar -czf "$ARCHIVE" -C "$BACKUP_BASE/Daily" "$(basename "$LATEST_DAILY")"
SIZE=$(du -sh "$ARCHIVE" | cut -f1)
echo "  Archive: $ARCHIVE ($SIZE)"

# Step 3: Checksum
echo ""
echo "[ Step 3/5 ] Generating checksum..."
shasum -a 256 "$ARCHIVE" > "$CHECKSUM"
echo "  SHA256: $(cat "$CHECKSUM" | cut -d' ' -f1)"

# Step 4: Verify
echo ""
echo "[ Step 4/5 ] Verifying archive integrity..."
if tar -tzf "$ARCHIVE" > /dev/null 2>&1; then
  echo "  ✅ Archive integrity: OK"
else
  echo "  ❌ Archive is corrupt!"
  exit 1
fi

if shasum -a 256 -c "$CHECKSUM" > /dev/null 2>&1; then
  echo "  ✅ Checksum verified"
else
  echo "  ❌ Checksum mismatch!"
  exit 1
fi

# Step 5: Prune old backups
echo ""
echo "[ Step 5/5 ] Pruning old backups..."

# Keep only 7 daily backups
DAILY_COUNT=$(ls -d "$BACKUP_BASE/Daily"/*/ 2>/dev/null | wc -l)
if [ "$DAILY_COUNT" -gt 7 ]; then
  ls -td "$BACKUP_BASE/Daily"/*/ | tail -n +8 | while read -r old; do
    echo "  Removing old daily: $(basename "$old")"
    rm -rf "$old"
  done
fi

# Keep only 8 weekly archives
WEEKLY_COUNT=$(ls "$WEEKLY_DIR"/*.tar.gz 2>/dev/null | wc -l)
if [ "$WEEKLY_COUNT" -gt 8 ]; then
  ls -t "$WEEKLY_DIR"/*.tar.gz | tail -n +9 | while read -r old; do
    echo "  Removing old weekly: $(basename "$old")"
    rm -f "$old" "${old}.sha256"
  done
fi

echo "  Daily backups retained:  $(ls -d "$BACKUP_BASE/Daily"/*/ 2>/dev/null | wc -l)/7"
echo "  Weekly archives retained: $(ls "$WEEKLY_DIR"/*.tar.gz 2>/dev/null | wc -l)/8"

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Weekly backup complete"
echo "  Archive: $ARCHIVE"
echo "  Size:    $SIZE"
echo "══════════════════════════════════════════"
echo ""
