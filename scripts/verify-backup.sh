#!/bin/bash
# Sean Media Server — Verify Backup
# Verifies the integrity of a backup archive before relying on it for restore.
#
# Usage:
#   bash verify-backup.sh                         — verify most recent weekly
#   bash verify-backup.sh /path/to/backup.tar.gz  — verify specific archive

set -euo pipefail

BACKUP_BASE="$HOME/Backups/MediaServer-Backups"
PASS=0; WARN=0; FAIL=0

ok()   { echo "  ✅ $*"; PASS=$((PASS+1)); }
warn() { echo "  ⚠️  $*"; WARN=$((WARN+1)); }
fail() { echo "  ❌ $*"; FAIL=$((FAIL+1)); }

echo ""
echo "══════════════════════════════════════════"
echo "  Sean Media Server — Verify Backup"
echo "══════════════════════════════════════════"
echo ""

# Determine what to verify
verify_directory() {
  local dir="$1"
  echo "  Directory: $dir"
  echo ""
  for required in \
    "jellyfin/config" \
    "jellyfin/data" \
    "samba/smb.conf" \
    "system/system-info.txt" \
    "system/installed-packages.txt" \
    "MANIFEST.txt" \
    "BACKUP_INFO.txt"; do
    if [ -e "$dir/$required" ]; then
      ok "$required"
    else
      warn "$required missing"
    fi
  done
  echo ""
  if [ -f "$dir/BACKUP_INFO.txt" ]; then
    echo "  Backup info:"
    cat "$dir/BACKUP_INFO.txt" | sed 's/^/    /'
    echo ""
  fi
  FILE_COUNT=$(find "$dir" -type f | wc -l)
  DIR_SIZE=$(du -sh "$dir" | cut -f1)
  echo "  Files: $FILE_COUNT  |  Size: $DIR_SIZE"
}

if [ -n "${1:-}" ] && [ -d "$1" ]; then
  verify_directory "$1"
  echo ""
  echo "══════════════════════════════════════════"
  printf "  Results:  ✅ %d passed   ⚠️  %d warnings   ❌ %d failed\n" $PASS $WARN $FAIL
  [ "$FAIL" -gt 0 ] && echo "  Status: BACKUP INVALID" && exit 1
  [ "$WARN" -gt 0 ] && echo "  Status: BACKUP USABLE WITH WARNINGS" && exit 0
  echo "  Status: BACKUP VERIFIED — safe to use for restore"
  echo "══════════════════════════════════════════"
  echo ""
  exit 0
fi

if [ -n "${1:-}" ]; then
  ARCHIVE="$1"
else
  ARCHIVE=$(ls -t "$BACKUP_BASE/Weekly"/*.tar.gz 2>/dev/null | head -1)
  if [ -z "$ARCHIVE" ]; then
    LATEST=$(ls -td "$BACKUP_BASE/Daily"/*/ "$BACKUP_BASE/Manual"/*/ 2>/dev/null | head -1)
    if [ -z "$LATEST" ]; then
      echo "  No backups found. Run backup.sh first."
      exit 1
    fi
    verify_directory "$LATEST"
    echo ""
    echo "══════════════════════════════════════════"
    printf "  Results:  ✅ %d passed   ⚠️  %d warnings   ❌ %d failed\n" $PASS $WARN $FAIL
    [ "$FAIL" -gt 0 ] && echo "  Status: BACKUP INVALID" && exit 1
    [ "$WARN" -gt 0 ] && echo "  Status: BACKUP USABLE WITH WARNINGS" && exit 0
    echo "  Status: BACKUP VERIFIED — safe to use for restore"
    echo "══════════════════════════════════════════"
    echo ""
    exit 0
  fi
fi

echo "  Archive: $ARCHIVE"
CHECKSUM="${ARCHIVE}.sha256"
echo ""

# 1. Archive exists
[ -f "$ARCHIVE" ] && ok "Archive file exists" || { fail "Archive not found: $ARCHIVE"; exit 1; }

# 2. Checksum file exists
if [ -f "$CHECKSUM" ]; then
  ok "Checksum file exists"
  # 3. Checksum matches
  if shasum -a 256 -c "$CHECKSUM" > /dev/null 2>&1; then
    ok "SHA256 checksum verified"
  else
    fail "SHA256 checksum MISMATCH — archive may be corrupt"
  fi
else
  warn "No checksum file found — cannot verify integrity"
fi

# 4. Archive can be read
if tar -tzf "$ARCHIVE" > /dev/null 2>&1; then
  ok "Archive readable (tar integrity OK)"
else
  fail "Archive is corrupt — cannot be extracted"
fi

# 5. Check required contents
echo ""
echo "  Checking required contents..."
CONTENTS=$(tar -tzf "$ARCHIVE" 2>/dev/null)

check_in_archive() {
  local pattern="$1"
  if echo "$CONTENTS" | grep -q "$pattern"; then
    ok "Found: $pattern"
  else
    warn "Missing: $pattern"
  fi
}

check_in_archive "jellyfin/config"
check_in_archive "jellyfin/data"
check_in_archive "samba/smb.conf"
check_in_archive "system/system-info.txt"
check_in_archive "system/installed-packages.txt"
check_in_archive "MANIFEST.txt"
check_in_archive "BACKUP_INFO.txt"

# 6. Show backup info
echo ""
echo "  Backup info:"
tar -xOf "$ARCHIVE" --wildcards "*/BACKUP_INFO.txt" 2>/dev/null | sed 's/^/    /' || warn "Could not read BACKUP_INFO.txt"

# 7. File count
FILE_COUNT=$(echo "$CONTENTS" | wc -l)
echo ""
echo "  Files in archive: $FILE_COUNT"
ARCHIVE_SIZE=$(du -sh "$ARCHIVE" | cut -f1)
echo "  Archive size:     $ARCHIVE_SIZE"

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════"
printf "  Results:  ✅ %d passed   ⚠️  %d warnings   ❌ %d failed\n" $PASS $WARN $FAIL
if [ "$FAIL" -gt 0 ]; then
  echo "  Status: BACKUP INVALID — do not use for restore"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo "  Status: BACKUP USABLE WITH WARNINGS"
else
  echo "  Status: BACKUP VERIFIED — safe to use for restore"
fi
echo "══════════════════════════════════════════"
echo ""
