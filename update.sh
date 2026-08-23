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

# 3. If Docker is running, rebuild container
if command -v docker &> /dev/null && docker compose version &> /dev/null && [ -f "docker-compose.yml" ]; then
    echo ">> Updating Docker deployment..."
    docker compose down || true
    docker compose build
    docker compose up -d
    docker image prune -f || true
    echo ">> Upgrade complete! CCTV Hub running at http://localhost:8000"
    exit 0
fi

# 4. Native Linux / LXC Container Upgrade
echo ">> Updating Python backend packages..."
if [ -d ".venv" ]; then
    .venv/bin/pip install -r backend/requirements.txt
else
    pip3 install -r backend/requirements.txt
fi

echo ">> Compiling React Frontend..."
if command -v npm &> /dev/null && [ -d "frontend" ]; then
    cd frontend
    npm install
    npm run build
    cd ..
fi

echo ">> Restarting system service..."
if command -v systemctl &> /dev/null && systemctl is-active --quiet cctv-hub; then
    sudo systemctl restart cctv-hub
    echo ">> Systemd service 'cctv-hub' restarted."
else
    echo ">> Upgrade finished! Start the server with:"
    echo "   uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"
fi

echo "========================================="
echo "  Upgrade successfully finished!        "
echo "========================================="
