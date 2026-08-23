#!/usr/bin/env bash
set -e

echo "========================================="
echo "  CCTV Surveillance Hub - Git Updater   "
echo "========================================="

# 1. Verify Git is available
if ! command -v git &> /dev/null; then
    echo "[!] Error: git is not installed."
    exit 1
fi

# 2. Fetch and pull latest changes
echo ">> Fetching latest updates from Git repository..."
git fetch --all
BRANCH=$(git rev-parse --abbrev-ref HEAD || echo "main")
git pull origin "$BRANCH"

# 3. Check if running as native systemd service on Host / LXC
IS_SYSTEMD=false
if [ -f "/etc/systemd/system/cctv-hub.service" ] || [ -d ".venv" ]; then
    IS_SYSTEMD=true
fi

if [ "$IS_SYSTEMD" = true ]; then
    echo ">> Updating Native Host Installation..."
    
    # Update Python backend dependencies
    echo ">> Upgrading Python backend dependencies..."
    if [ -d ".venv" ]; then
        .venv/bin/pip install -r backend/requirements.txt
    else
        pip3 install -r backend/requirements.txt
    fi

    # Compile React Frontend
    echo ">> Compiling React Frontend..."
    if command -v npm &> /dev/null && [ -d "frontend" ]; then
        cd frontend
        npm install
        npm run build
        cd ..
    fi

    # Restart systemd service
    if [ -f "/etc/systemd/system/cctv-hub.service" ]; then
        echo ">> Restarting systemd service 'cctv-hub'..."
        if command -v sudo &> /dev/null; then
            sudo systemctl restart cctv-hub
        else
            systemctl restart cctv-hub
        fi
        echo ">> Systemd service 'cctv-hub' restarted successfully!"
    fi

    # Create 1-word global update command
    chmod +x /opt/cctv-hub/update.sh 2>/dev/null || true
    ln -sf /opt/cctv-hub/update.sh /usr/local/bin/cctv-update 2>/dev/null || true

    echo "========================================="
    echo "  Upgrade Successfully Finished!        "
    echo "  Dashboard running at http://localhost:8000"
    echo "  Quick update command: cctv-update     "
    echo "========================================="
    exit 0
fi

# 4. If running as Docker container
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
