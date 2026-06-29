@echo off
title Sleek DFD Generator Launcher
echo ===================================================
echo   Starting Sleek DFD Generator Setup
echo ===================================================
echo Installing requirements...
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo Error installing dependencies. Please check if Python and pip are installed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Launching FastAPI Application Server...
echo The app will be available at http://127.0.0.1:8000
echo Press Ctrl+C in this terminal window to stop the server.
echo ===================================================
echo.
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
pause
