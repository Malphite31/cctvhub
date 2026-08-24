#!/usr/bin/env bash
set -e

echo "========================================="
echo "  CCTV Surveillance Hub - Git Updater   "
echo "========================================="

# 1. Resolve and navigate to repository installation directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "/opt/cctv-hub/backend/app/main.py" ]; then
    INSTALL_DIR="/opt/cctv-hub"
elif [ -f "$SCRIPT_DIR/backend/app/main.py" ]; then
    INSTALL_DIR="$SCRIPT_DIR"
else
    INSTALL_DIR="$(pwd)"
fi

cd "$INSTALL_DIR"
echo ">> Working in: $INSTALL_DIR"

# 2. Verify Git is available and configure safe directory
if ! command -v git &> /dev/null; then
    echo "[!] Error: git is not installed."
    exit 1
fi
git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true

# 3. Fetch and pull latest changes
echo ">> Fetching latest updates from Git repository..."
git fetch --all --prune || true
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
git reset --hard "origin/$BRANCH" || git pull origin "$BRANCH" || true

# 4. Check if running as native systemd service on Host / LXC
IS_SYSTEMD=false
if [ -f "/etc/systemd/system/cctv-hub.service" ] || [ -d ".venv" ] || [ -d "backend/venv" ]; then
    IS_SYSTEMD=true
fi

if [ "$IS_SYSTEMD" = true ]; then
    echo ">> Updating Native Host / Proxmox LXC Installation..."
    
    # Update Python backend dependencies
    echo ">> Upgrading Python backend dependencies..."
    if [ -d ".venv" ]; then
        .venv/bin/pip install --upgrade pip setuptools wheel 2>/dev/null || true
        .venv/bin/pip install -r backend/requirements.txt
    elif [ -d "backend/venv" ]; then
        backend/venv/bin/pip install --upgrade pip setuptools wheel 2>/dev/null || true
        backend/venv/bin/pip install -r backend/requirements.txt
    else
        pip3 install -r backend/requirements.txt 2>/dev/null || true
    fi

    # Synchronize Pre-built Frontend Distribution
    if [ -d "backend/frontend_dist" ]; then
        echo ">> Synchronizing pre-built React frontend bundle..."
        mkdir -p frontend/dist
        cp -r backend/frontend_dist/* frontend/dist/ 2>/dev/null || true
    fi

    # Compile React Frontend if Node/NPM is installed
    if command -v npm &> /dev/null && [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
        echo ">> Compiling React Frontend with NPM..."
        cd frontend
        npm install --prefer-offline 2>/dev/null || true
        npm run build 2>/dev/null || true
        cd "$INSTALL_DIR"
    fi

    # Migrate systemd service port to 18860 if old 8000 port was present
    if [ -f "/etc/systemd/system/cctv-hub.service" ]; then
        if grep -q "port 8000" /etc/systemd/system/cctv-hub.service; then
            echo ">> Aligning systemd service port to 18860..."
            sed -i 's/--port 8000/--port 18860/g' /etc/systemd/system/cctv-hub.service
            systemctl daemon-reload 2>/dev/null || true
        fi
    fi

    # Restart systemd service cleanly
    if [ -f "/etc/systemd/system/cctv-hub.service" ]; then
        echo ">> Restarting systemd service 'cctv-hub'..."
        # Clean any stale go2rtc or lingering ports
        killall -9 go2rtc 2>/dev/null || true
        if command -v sudo &> /dev/null; then
            sudo systemctl daemon-reload 2>/dev/null || true
            sudo systemctl restart cctv-hub
        else
            systemctl daemon-reload 2>/dev/null || true
            systemctl restart cctv-hub
        fi
        echo ">> Systemd service 'cctv-hub' restarted successfully!"
    fi

    # Create / update global 1-word cctv-update command
    chmod +x "$INSTALL_DIR/update.sh" 2>/dev/null || true
    ln -sf "$INSTALL_DIR/update.sh" /usr/local/bin/cctv-update 2>/dev/null || true

    echo "========================================="
    echo "  Upgrade Successfully Finished!        "
    echo "  Dashboard running at http://localhost:18860"
    echo "  Quick update command: cctv-update     "
    echo "========================================="
    exit 0
fi

# 5. If running as Docker container
if command -v docker &> /dev/null && [ -f "docker-compose.yml" ]; then
    echo ">> Updating Docker deployment..."
    docker compose down || true
    docker compose build
    docker compose up -d
    docker image prune -f || true
    echo ">> Docker upgrade complete! CCTV Hub running at http://localhost:8000"
    exit 0
fi

echo ">> Upgrade complete!"
