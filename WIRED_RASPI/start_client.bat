@echo off
title ACAP Display Client
cd /d "%~dp0"

set PORT=8080

start /B python -m http.server %PORT%

timeout /t 1 /nobreak > nul

start http://localhost:%PORT%/index.html

echo.
echo Client running at http://localhost:%PORT%/index.html
echo Close this window to stop the local server.
pause > nul

taskkill /F /IM python.exe > nul 2>&1
