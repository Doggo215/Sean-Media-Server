#!/bin/bash
# Update Sean Media Server (OS packages + Jellyfin)
# Run from Mac: bash scripts/update.sh
# Or run directly on Pi as: sudo bash update.sh

PI="sean@10.0.0.226"

echo "=============================="
echo "  Sean Media Server — Update"
echo "=============================="
echo ""

echo "Checking for updates..."
ssh "$PI" "sudo apt update 2>&1 | tail -3"

echo ""
echo "Packages available for upgrade:"
ssh "$PI" "apt list --upgradable 2>/dev/null | grep -v Listing"

echo ""
read -p "Proceed with upgrade? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "Upgrading packages..."
ssh "$PI" "sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y 2>&1 | tail -10"

echo ""
echo "Checking if reboot is required..."
REBOOT=$(ssh "$PI" "test -f /var/run/reboot-required && echo YES || echo NO")
echo "Reboot required: $REBOOT"

if [ "$REBOOT" = "YES" ]; then
  echo ""
  read -p "Reboot now? (y/N): " REBOOT_CONFIRM
  if [ "$REBOOT_CONFIRM" = "y" ] || [ "$REBOOT_CONFIRM" = "Y" ]; then
    echo "Rebooting Pi..."
    ssh "$PI" "sudo reboot" 2>/dev/null
    echo "Waiting 45 seconds for Pi to come back..."
    sleep 45
    echo "Verifying SSH reconnect..."
    ssh -o ConnectTimeout=10 "$PI" "hostname && systemctl is-active jellyfin"
  fi
fi

echo ""
echo "Update complete."
