#!/bin/bash
# Sean Media Server — Health Check
# Returns a PASS / WARNING / FAIL report for all critical systems.
#
# Usage: bash health-check.sh

PI="sean@10.0.0.225"
JELLYFIN_URL="http://10.0.0.225:8096"
DISK_WARN=80   # % used before WARNING
DISK_FAIL=95   # % used before FAIL
TEMP_WARN=70   # °C before WARNING
TEMP_FAIL=80   # °C before FAIL
RAM_WARN=85    # % used before WARNING

PASS=0; WARN=0; FAIL=0

ok()   { printf "  %-35s ✅ PASS\n"    "$1"; PASS=$((PASS+1)); }
warn() { printf "  %-35s ⚠️  WARNING — %s\n" "$1" "$2"; WARN=$((WARN+1)); }
fail() { printf "  %-35s ❌ FAIL — %s\n"     "$1" "$2"; FAIL=$((FAIL+1)); }

echo ""
echo "══════════════════════════════════════════"
echo "  Sean Media Server — Health Check"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════"

# ─── Connectivity ────────────────────────────────────────────────────────────

echo ""
echo "[ Network & SSH ]"

if ssh -o ConnectTimeout=5 -o BatchMode=yes "$PI" "exit" 2>/dev/null; then
  ok "SSH ($PI)"
else
  fail "SSH ($PI)" "cannot connect"
  echo ""
  echo "  Cannot reach the Pi. All further checks skipped."
  echo "  Total: ✅ $PASS  ⚠️  $WARN  ❌ $FAIL"
  exit 1
fi

if ping -c 1 -W 2 10.0.0.1 > /dev/null 2>&1; then
  ok "Router (10.0.0.1)"
else
  warn "Router (10.0.0.1)" "not responding"
fi

# ─── Jellyfin ────────────────────────────────────────────────────────────────

echo ""
echo "[ Jellyfin ]"

JF_ACTIVE=$(ssh -o ConnectTimeout=5 "$PI" "systemctl is-active jellyfin" 2>/dev/null || echo "failed")
if [ "$JF_ACTIVE" = "active" ]; then
  ok "jellyfin.service"
else
  fail "jellyfin.service" "$JF_ACTIVE"
fi

JF_ENABLED=$(ssh -o ConnectTimeout=5 "$PI" "systemctl is-enabled jellyfin" 2>/dev/null || echo "failed")
if [ "$JF_ENABLED" = "enabled" ]; then
  ok "Jellyfin autostart"
else
  warn "Jellyfin autostart" "not enabled on boot"
fi

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${JELLYFIN_URL}/web/index.html" 2>/dev/null || echo "000")
if [ "$HTTP" = "200" ]; then
  ok "Jellyfin web UI (HTTP $HTTP)"
else
  fail "Jellyfin web UI" "HTTP $HTTP"
fi

JF_PORT=$(ssh -o ConnectTimeout=5 "$PI" "ss -tlnp | grep 8096 | wc -l" 2>/dev/null || echo "0")
if [ "$JF_PORT" -gt 0 ]; then
  ok "Jellyfin port 8096 listening"
else
  warn "Jellyfin port 8096" "not found in ss output"
fi

# ─── Samba ───────────────────────────────────────────────────────────────────

echo ""
echo "[ Samba ]"

for svc in smbd nmbd; do
  STATUS=$(ssh -o ConnectTimeout=5 "$PI" "systemctl is-active $svc" 2>/dev/null || echo "failed")
  if [ "$STATUS" = "active" ]; then
    ok "$svc"
  else
    fail "$svc" "$STATUS"
  fi
done

SMB_PORT=$(nc -z -w2 10.0.0.225 445 2>/dev/null && echo "open" || echo "closed")
if [ "$SMB_PORT" = "open" ]; then
  ok "SMB port 445"
else
  fail "SMB port 445" "not reachable"
fi

# ─── Media Drop ──────────────────────────────────────────────────────────────

echo ""
echo "[ Media Drop ]"

MD_PID=$(launchctl list | grep "com.sean.mediadrop" | awk '{print $1}')
if [ -n "$MD_PID" ] && [ "$MD_PID" != "-" ]; then
  ok "Media Drop service (PID $MD_PID)"
else
  warn "Media Drop service" "not running (launchctl)"
fi

MD_DROP="$HOME/Desktop/Media Drop"
if [ -d "$MD_DROP" ]; then
  ok "Media Drop folder exists"
else
  fail "Media Drop folder" "not found at $MD_DROP"
fi

# ─── Storage ─────────────────────────────────────────────────────────────────

echo ""
echo "[ Storage ]"

DISK_INFO=$(ssh -o ConnectTimeout=5 "$PI" "df / | tail -1 | awk '{print \$5, \$4}'" 2>/dev/null || echo "0% 0")
DISK_PCT=$(echo "$DISK_INFO" | awk '{print $1}' | tr -d '%')
DISK_FREE=$(echo "$DISK_INFO" | awk '{print $2}')
DISK_FREE_H=$(ssh -o ConnectTimeout=5 "$PI" "df -h / | tail -1 | awk '{print \$4}'" 2>/dev/null || echo "?")

if [ "$DISK_PCT" -ge "$DISK_FAIL" ]; then
  fail "Disk usage" "${DISK_PCT}% used (${DISK_FREE_H} free)"
elif [ "$DISK_PCT" -ge "$DISK_WARN" ]; then
  warn "Disk usage" "${DISK_PCT}% used (${DISK_FREE_H} free)"
else
  ok "Disk usage (${DISK_PCT}% used, ${DISK_FREE_H} free)"
fi

# /srv/media exists
SRV_CHECK=$(ssh -o ConnectTimeout=5 "$PI" "[ -d /srv/media ] && echo ok || echo missing" 2>/dev/null)
if [ "$SRV_CHECK" = "ok" ]; then
  ok "/srv/media directory"
else
  fail "/srv/media" "directory missing"
fi

# ─── Permissions ─────────────────────────────────────────────────────────────

echo ""
echo "[ Permissions ]"

PERM_CHECK=$(ssh -o ConnectTimeout=5 "$PI" "
  sudo -u jellyfin touch /srv/media/.perm_test 2>/dev/null && \
  sudo -u jellyfin rm /srv/media/.perm_test && echo ok || echo fail
" 2>/dev/null)
if [ "$PERM_CHECK" = "ok" ]; then
  ok "Jellyfin can write to /srv/media"
else
  fail "Jellyfin write permission" "/srv/media not writable by jellyfin"
fi

# ─── System health ───────────────────────────────────────────────────────────

echo ""
echo "[ System ]"

# Temperature
TEMP_RAW=$(ssh -o ConnectTimeout=5 "$PI" "vcgencmd measure_temp 2>/dev/null" | grep -oE '[0-9]+\.[0-9]+' || echo "0")
TEMP_INT=${TEMP_RAW%.*}
if [ "$TEMP_INT" -ge "$TEMP_FAIL" ]; then
  fail "CPU temperature" "${TEMP_RAW}°C — overheating"
elif [ "$TEMP_INT" -ge "$TEMP_WARN" ]; then
  warn "CPU temperature" "${TEMP_RAW}°C — running hot"
else
  ok "CPU temperature (${TEMP_RAW}°C)"
fi

# RAM
RAM_INFO=$(ssh -o ConnectTimeout=5 "$PI" "free | grep Mem | awk '{printf \"%d %d\", \$3/\$2*100, \$7/1024}'" 2>/dev/null || echo "0 0")
RAM_PCT=$(echo "$RAM_INFO" | awk '{print $1}')
RAM_AVAIL=$(echo "$RAM_INFO" | awk '{print $2}')
if [ "$RAM_PCT" -ge "$RAM_WARN" ]; then
  warn "RAM usage" "${RAM_PCT}% used (${RAM_AVAIL}MB available)"
else
  ok "RAM usage (${RAM_PCT}% used, ${RAM_AVAIL}MB available)"
fi

# Uptime
UPTIME=$(ssh -o ConnectTimeout=5 "$PI" "uptime -p" 2>/dev/null || echo "unknown")
ok "System uptime ($UPTIME)"

# Disabled services still disabled
for svc in panel-os stadium-os; do
  STATE=$(ssh -o ConnectTimeout=5 "$PI" "systemctl is-enabled $svc 2>/dev/null" 2>/dev/null | head -1 | tr -d '[:space:]') || true
  if [ "$STATE" = "disabled" ] || [ "$STATE" = "static" ] || [ -z "$STATE" ]; then
    ok "$svc.service disabled (expected)"
  else
    warn "$svc.service" "unexpectedly $STATE"
  fi
done

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════"
printf "  Results:  ✅ %d passed   ⚠️  %d warnings   ❌ %d failed\n" $PASS $WARN $FAIL

if [ "$FAIL" -gt 0 ]; then
  echo "  Status:   ❌ FAIL — action required"
  echo "══════════════════════════════════════════"
  echo ""
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo "  Status:   ⚠️  WARNING — monitor these items"
  echo "══════════════════════════════════════════"
  echo ""
  exit 0
else
  echo "  Status:   ✅ ALL SYSTEMS HEALTHY"
  echo "══════════════════════════════════════════"
  echo ""
  exit 0
fi
