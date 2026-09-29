@echo off
setlocal
echo.
echo   __ __     __
echo  / // /__  / /___  _______ 
echo / _  / _ \/ / / / / / _  / 
echo \_,_/\___/_/\___,_/\_, /  
echo                    /___/   
echo.
echo   Veloce -- Video Downloader
echo.

:: Check Python
where python >nul 2>&1
if %errorlevel% neq 0 (
  echo   [!] Python not found.
  echo       Download from: https://python.org/downloads
  echo       Make sure to check "Add Python to PATH"
  pause
  exit /b 1
)
echo   [OK] Python found

:: Check yt-dlp -- prefer the standalone exe in this folder
if exist "%~dp0yt-dlp.exe" (
  set "YTDLP=%~dp0yt-dlp.exe"
  echo   [OK] yt-dlp.exe found in folder
  goto :run
)

:: Check if yt-dlp already installed globally
where yt-dlp >nul 2>&1
if %errorlevel% == 0 (
  set "YTDLP=yt-dlp"
  echo   [OK] yt-dlp found in PATH
  goto :run
)

:: Not found -- download the standalone exe directly (no pip needed)
echo   [..] yt-dlp not found. Downloading yt-dlp.exe...
echo        (This is a one-time download of ~10 MB)
echo.

:: Try PowerShell download (built into Windows 8+)
powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = 'Tls12'; (New-Object Net.WebClient).DownloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', '%~dp0yt-dlp.exe') }" 2>nul
if exist "%~dp0yt-dlp.exe" (
  set "YTDLP=%~dp0yt-dlp.exe"
  echo   [OK] Downloaded yt-dlp.exe
  goto :run
)

echo   [!] Auto-download failed (network may be blocked).
echo.
echo   Manual fix -- do ONE of these:
echo   1. Download yt-dlp.exe from:
echo      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
echo      and put it in the same folder as this file.
echo.
echo   2. Or install via winget (Windows 10+):
echo      winget install yt-dlp
echo.
pause
exit /b 1

:run
:: Write path to a temp config so server.py can find it
echo %YTDLP% > "%~dp0ytdlp_path.txt"

echo.
echo   [OK] Starting Veloce at http://localhost:8899
echo.
start http://localhost:8899
python "%~dp0server.py"
pause
