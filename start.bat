@echo off
setlocal enabledelayedexpansion
title CCTV 60 FPS Surveillance Hub
color 0B
cd /d "%~dp0"

echo ==============================================================================
echo                      CCTV 60 FPS SURVEILLANCE HUB                             
echo ==============================================================================
echo.

:: 1. Check Python installation
echo [*] Checking Python environment...
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Python is not installed or not found in system PATH.
    echo Please install Python 3.10+ from https://www.python.org/ and check
    echo "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PY_VER=%%i
echo [OK] Found !PY_VER!

:: 2. Setup / Activate Virtual Environment (.venv)
if not exist ".venv" (
    echo [*] Creating virtual environment (.venv)...
    python -m venv .venv
    if !ERRORLEVEL! neq 0 (
        echo [!] Failed to create .venv, falling back to global Python...
        set "PY_CMD=python"
    ) else (
        echo [OK] Virtual environment created.
        set "PY_CMD=.venv\Scripts\python.exe"
    )
) else (
    set "PY_CMD=.venv\Scripts\python.exe"
)

:: 3. Install / Verify Dependencies
echo [*] Verifying backend dependencies...
!PY_CMD! -m pip install -q -r backend/requirements.txt opencv-python
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Failed to install required Python packages.
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencies ready.

:: 4. Start CCTV Hub and Open Browser
echo.
echo ==============================================================================
echo  CCTV Hub starting at: http://127.0.0.1:18860
echo  Press Ctrl+C in this terminal to stop the server.
echo ==============================================================================
echo.

:: Open browser automatically
start "" powershell -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process 'http://127.0.0.1:18860'"


:: Start Uvicorn Server
!PY_CMD! -m uvicorn backend.app.main:app --host 0.0.0.0 --port 18860 --reload

if %ERRORLEVEL% neq 0 (
    echo.
    color 0C
    echo [!] Server stopped with error code %ERRORLEVEL%.
    pause
)
