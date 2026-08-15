@echo off
title Merit List Control Station
echo ===================================================
echo Starting the Merit List Control Station...
echo ===================================================

:: Start the mock Raspberry Pi server in a separate hidden background task (Optional: you can delete this line later)
start /B python mock_pi_server.py

:: Wait for 2 seconds to let the servers start up
timeout /t 2 /nobreak > nul

:: Open the default web browser to your app
start http://127.0.0.1:8000

:: Start the main FastAPI server
python main.py

pause