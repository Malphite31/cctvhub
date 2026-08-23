#!/bin/bash
# ==============================================================================
# Single-command launcher for CCTV 60 FPS Hub inside LXC
# ==============================================================================

set -e

echo "=== Starting CCTV 60 FPS Surveillance Hub ==="

# 1. Download go2rtc if not installed
if ! command -v go2rtc &> /dev/null; then
    echo "[+] Downloading go2rtc streaming engine..."
    curl -L -s https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_amd64 -o /usr/local/bin/go2rtc
    chmod +x /usr/local/bin/go2rtc
fi

# 2. Check Python virtual environment
if [ ! -d "backend/venv" ]; then
    echo "[+] Creating Python virtual environment..."
    python3 -m venv backend/venv
    backend/venv/bin/pip install --upgrade pip
    backend/venv/bin/pip install -r backend/requirements.txt
fi

# 3. Start go2rtc streaming engine in background
echo "[+] Starting go2rtc on port 18864..."
go2rtc -config backend/streaming/go2rtc.yaml &
GO2RTC_PID=$!

# 4. Start FastAPI server
echo "[+] Starting FastAPI server on port 18860..."
backend/venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 18860 &
FASTAPI_PID=$!

echo ""
echo "=========================================================="
echo " CCTV 60 FPS Hub is LIVE!"
echo " Local UI & API:       http://localhost:18860"
echo " Stream Engine (MSE):  http://localhost:18864"
echo "=========================================================="

trap "kill $GO2RTC_PID $FASTAPI_PID; exit" SIGINT SIGTERM
wait
