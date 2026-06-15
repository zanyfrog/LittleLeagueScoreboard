@echo off
setlocal

cd /d "%~dp0"

set "SITE_URL=http://127.0.0.1:3000/"
set "LL_SCORE_DATA_DIR=%LOCALAPPDATA%\LittleLeagueScoreboard\data"

where node.exe >nul 2>&1
if errorlevel 1 (
  set "LOCAL_NODE=%LOCALAPPDATA%\Programs\nodejs"
  if exist "%LOCAL_NODE%\node.exe" (
    set "PATH=%LOCAL_NODE%;%PATH%"
  ) else (
    echo ERROR: Node.js was not found.
    echo Run setup-node-shell.cmd, then open a new terminal and try again.
    pause
    exit /b 1
  )
)

where pnpm.cmd >nul 2>&1
if errorlevel 1 (
  echo ERROR: pnpm was not found.
  echo Run setup-node-shell.cmd, then open a new terminal and try again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo ERROR: Project dependencies are not installed.
  echo Run this command from %CD%:
  echo   pnpm install
  pause
  exit /b 1
)

powershell.exe -NoProfile -Command ^
  "if (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue) { exit 1 }"
if errorlevel 1 (
  echo ERROR: Port 3000 is already in use.
  echo The website may already be running at %SITE_URL%
  pause
  exit /b 1
)

echo Starting Little League Scoreboard...
echo Website: %SITE_URL%
echo Data:    %LL_SCORE_DATA_DIR%
echo.
echo Keep this window open while using the website.
echo Press Ctrl+C to stop the server.
echo.

call pnpm.cmd landing:dev
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo The website stopped with error code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
