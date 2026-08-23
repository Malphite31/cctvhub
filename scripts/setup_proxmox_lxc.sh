#!/bin/bash
# ==============================================================================
# Proxmox VE Host Configuration Script: Pass USB Webcam to LXC Container
# Run this script on your Proxmox VE Host (as root)
# Usage: ./setup_proxmox_lxc.sh <LXC_CONTAINER_ID>
# ==============================================================================

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <LXC_CONTAINER_ID>"
    echo "Example: $0 100"
    exit 1
fi

CT_ID="$1"
CONF_FILE="/etc/pve/lxc/${CT_ID}.conf"

if [ ! -f "$CONF_FILE" ]; then
    echo "[!] Error: Container configuration file $CONF_FILE does not exist."
    exit 1
fi

echo "[+] Checking for video devices on Proxmox Host..."
ls -la /dev/video* || {
    echo "[!] No /dev/video* devices found on Proxmox host. Ensure webcam is plugged in."
    exit 1
}

# Identify major numbers for video devices (typically 81)
DEV_MAJOR=$(ls -la /dev/video0 | awk '{print $5}' | tr -d ',')

echo "[+] Detected device major number: $DEV_MAJOR"
echo "[+] Appending webcam passthrough rules to $CONF_FILE..."

# Backup existing config
cp "$CONF_FILE" "${CONF_FILE}.bak_$(date +%s)"

# Remove old CCTV passthrough entries if present
sed -i '/# CCTV Webcam Passthrough/d' "$CONF_FILE"
sed -i '/lxc.cgroup2.devices.allow: c 81:\* rwm/d' "$CONF_FILE"
sed -i '/lxc.cgroup2.devices.allow: c 226:\* rwm/d' "$CONF_FILE"
sed -i '/dev\/video/d' "$CONF_FILE"
sed -i '/dev\/dri/d' "$CONF_FILE"

cat <<EOT >> "$CONF_FILE"

# CCTV Webcam Passthrough
lxc.cgroup2.devices.allow: c 81:* rwm
lxc.cgroup2.devices.allow: c 226:* rwm
lxc.mount.entry: /dev/video0 dev/video0 none bind,optional,create=file
lxc.mount.entry: /dev/video1 dev/video1 none bind,optional,create=file
lxc.mount.entry: /dev/dri dev/dri none bind,optional,create=dir
EOT

echo "[+] Passthrough rules successfully added to container $CT_ID!"
echo "[+] Now restart the container using: pct stop $CT_ID && pct start $CT_ID"
