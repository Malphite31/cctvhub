@echo off
echo =========================================
echo   CCTV Surveillance Hub - Git Updater
echo =========================================

echo [1/3] Pulling latest updates from Git...
git pull

echo [2/3] Updating Python dependencies...
if exist ".venv\Scripts\python.exe" (
    .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
) else (
    pip install -r backend\requirements.txt
)

echo [3/3] Compiling Frontend...
if exist "frontend\package.json" (
    cd frontend
    call npm install
    call npm run build
    cd ..
)

echo =========================================
echo   Upgrade Complete!
echo =========================================
pause
