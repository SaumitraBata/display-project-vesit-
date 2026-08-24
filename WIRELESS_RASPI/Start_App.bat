@echo off
title Merit List Control Station
cd /d "%~dp0"

echo ===================================================
echo Starting the Merit List Control Station...
echo ===================================================

:: Create the virtual environment on first run, and install deps into it
if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv
    ".venv\Scripts\python.exe" -m pip install --upgrade pip
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
)

:: Open the default web browser to the control panel
timeout /t 1 /nobreak > nul
start http://127.0.0.1:8000

:: Start the FastAPI server from inside the venv (also advertises
:: acap-host.local via mDNS)
".venv\Scripts\python.exe" main.py

pause
