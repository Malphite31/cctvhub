@echo off
setlocal enabledelayedexpansion
title CCTV Surveillance Hub - Dev Mode (Vite + FastAPI)
color 0A
cd /d "%~dp0"

echo ==============================================================================
echo            CCTV 60 FPS Surveillance Hub (Frontend + Backend Dev)             
echo ==============================================================================
echo.

:: 1. Check Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Python not found in PATH.
    pause
    exit /b 1
)

:: 2. Check Node / npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Node.js / npm is not installed or not in PATH.
    echo Install Node.js LTS from https://nodejs.org/ to run Vite frontend dev server.
    pause
    exit /b 1
)

:: 3. Setup Python venv
if not exist ".venv" (
    echo [*] Initializing Python virtual environment...
    python -m venv .venv
    if !ERRORLEVEL! neq 0 (
        set "PY_CMD=python"
    ) else (
        set "PY_CMD=.venv\Scripts\python.exe"
    )
) else (
    set "PY_CMD=.venv\Scripts\python.exe"
)

echo [*] Verifying backend packages...
!PY_CMD! -m pip install -q -r backend/requirements.txt opencv-python

:: 4. Install frontend npm modules if missing
if not exist "frontend\node_modules" (
    echo [*] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

:: 5. Launch Backend in separate window
echo [*] Starting FastAPI Backend on http://127.0.0.1:18860...
start "CCTV Backend Server (Port 18860)" !PY_CMD! -m uvicorn backend.app.main:app --host 0.0.0.0 --port 18860 --reload

:: Allow backend 1.5s to start before starting Vite
timeout /t 2 /nobreak >nul

:: 6. Launch Frontend Dev Server
echo [*] Starting Vite Frontend on http://localhost:18861...
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process 'http://localhost:18861'"
cd frontend
call npm run dev
