#!/usr/bin/env bash
# ==========================================================
# Turnkey Native Host Installer for Proxmox VE & Debian/Ubuntu
# ==========================================================
set -e

# Must be run as root
if [ "$EUID" -ne 0 ]; then
  echo "[!] Please run this installer as root (e.g. sudo bash install.sh)"
  exit 1
fi

INSTALL_DIR="/opt/cctv-hub"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================================="
echo "  Installing CCTV Surveillance Hub on Proxmox / Host OS   "
echo "=========================================================="

# 1. Install System Packages
echo ">> [1/6] Installing runtime dependencies (FFmpeg, Python, V4L2)..."
apt-get update
apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    v4l-utils \
    curl \
    git \
    libgl1 \
    libglib2.0-0 \
    ca-certificates

# 2. Install Node.js if npm is missing (for building frontend)
if ! command -v npm &> /dev/null; then
    echo ">> [2/6] Installing Node.js for frontend UI build..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo ">> [2/6] Node.js is already installed."
fi

# 3. Copy/Clone Application into /opt/cctv-hub if not already there
echo ">> [3/6] Setting up application directory at $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
if [ "$CURRENT_DIR" != "$INSTALL_DIR" ]; then
    cp -ru "$CURRENT_DIR"/* "$INSTALL_DIR"/ || true
    cp -ru "$CURRENT_DIR"/.[!.]* "$INSTALL_DIR"/ 2>/dev/null || true
fi

cd "$INSTALL_DIR"

# 4. Download go2rtc binary to /usr/local/bin
echo ">> [4/6] Installing go2rtc ultra-low latency WebRTC engine..."
curl -L -s https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_amd64 -o /usr/local/bin/go2rtc
chmod +x /usr/local/bin/go2rtc

# 5. Setup Python Virtual Environment
echo ">> [5/6] Creating Python virtual environment & installing packages..."
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r backend/requirements.txt

# Build Frontend
if [ -d "frontend" ]; then
    echo ">> Building React Dashboard..."
    cd frontend
    npm install
    npm run build
    cd "$INSTALL_DIR"
fi

# Create data directories
mkdir -p backend/data/faces backend/data/recordings backend/data/snapshots

# 6. Setup Systemd Service for Auto-start on Host Boot
echo ">> [6/6] Creating systemd background service (cctv-hub.service)..."
cat << 'EOF' > /etc/systemd/system/cctv-hub.service
[Unit]
Description=CCTV 60 FPS Surveillance Hub
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/cctv-hub
ExecStart=/bin/sh -c "/usr/local/bin/go2rtc -config /opt/cctv-hub/backend/streaming/go2rtc.yaml & /opt/cctv-hub/.venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cctv-hub
systemctl restart cctv-hub

# Create 1-word global update command
chmod +x /opt/cctv-hub/update.sh
ln -sf /opt/cctv-hub/update.sh /usr/local/bin/cctv-update
chmod +x /usr/local/bin/cctv-update

HOST_IP=$(hostname -I | awk '{print $1}' || echo "localhost")

echo "=========================================================="
echo "  Installation Successful!                                "
echo "=========================================================="
echo "  Dashboard URL   : http://${HOST_IP}:8000"
echo "  Service Status  : systemctl status cctv-hub"
echo "  1-Word Updater  : cctv-update"
echo "=========================================================="
