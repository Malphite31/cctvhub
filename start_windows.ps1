# CCTV 60 FPS Surveillance Hub - Windows PowerShell Launcher
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   CCTV 60 FPS Surveillance Hub (Windows Testing)  " -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Install python deps if needed
Write-Host "[1/2] Verifying Python backend dependencies..." -ForegroundColor Yellow
python -m pip install -q -r backend/requirements.txt opencv-python

# 2. Launch FastAPI Server & Frontend
Write-Host "[2/2] Starting CCTV Hub server on http://localhost:18860..." -ForegroundColor Green
Write-Host ""
Write-Host "Opening CCTV Control Center Dashboard in your browser..." -ForegroundColor Cyan
Start-Process "http://localhost:18860"

python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 18860
