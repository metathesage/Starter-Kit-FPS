@echo off
title WAIFU DESTINY // Tactical Firing Range
color 0B
echo =======================================================================
echo          WAIFU DESTINY // TACTICAL FIRING RANGE
echo =======================================================================
echo.
echo [1/2] Checking local web server...
netstat -ano | findstr 8080 >nul
if %errorlevel% neq 0 (
  echo [SERVER] Starting local HTTP server on port 8080...
  cd /d "%~dp0halo-waifu-arena"
  start /b node server.js
  timeout /t 2 /nobreak >nul
) else (
  echo [SERVER] Server is already active on http://localhost:8080!
)
echo.
echo [2/2] Opening game in your default browser...
start "" "http://localhost:8080/d3/"
echo.
echo =======================================================================
echo   GAME RUNNING AT http://localhost:8080/d3/
echo =======================================================================
