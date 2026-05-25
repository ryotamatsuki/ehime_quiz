@echo off
setlocal

cd /d "%~dp0"

set "PORT=8000"
set "URL=http://127.0.0.1:%PORT%/"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to start the Ehime Quiz.
  echo Install Node.js, then double-click this file again.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 1; if ($response.StatusCode -eq 200) { exit 0 } exit 1 } catch { exit 1 }"
if errorlevel 1 (
  start "Ehime Quiz Server" /D "%~dp0" cmd /k node dev-server.js %PORT%
  timeout /t 2 /nobreak >nul
)

start "" "%URL%"

endlocal
