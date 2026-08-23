#!/bin/bash
# ==============================================================================
# Cloudflared Installation and Setup Helper for LXC
# ==============================================================================

set -e

echo "[+] Installing cloudflared inside Debian/Ubuntu LXC..."
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | tee /etc/apt/sources.list.d/cloudflared.list

apt-get update
apt-get install -y cloudflared

echo ""
echo "[+] Cloudflared successfully installed!"
echo "Version: $(cloudflared --version)"
echo ""
echo "Next steps:"
echo "1. Run: cloudflared tunnel login"
echo "2. Run: cloudflared tunnel create cctv-hub"
echo "3. Copy the tunnel ID into /app/cloudflare/config.yml"
echo "4. Route DNS: cloudflared tunnel route dns cctv-hub cctv.yourdomain.com"
echo "             cloudflared tunnel route dns cctv-hub cctv-stream.yourdomain.com"
echo "5. Start tunnel: cloudflared tunnel --config /app/cloudflare/config.yml run"
