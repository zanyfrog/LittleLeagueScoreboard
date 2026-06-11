@echo off
setlocal

set "NODE_DIR=%LOCALAPPDATA%\Programs\nodejs"

if not exist "%NODE_DIR%\node.exe" (
  echo ERROR: Node.js was not found at:
  echo %NODE_DIR%
  exit /b 1
)

powershell.exe -NoProfile -Command ^
  "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force; $userPath=[Environment]::GetEnvironmentVariable('Path','User'); if (($userPath -split ';') -notcontains '%NODE_DIR%') { [Environment]::SetEnvironmentVariable('Path', $userPath.TrimEnd(';') + ';%NODE_DIR%', 'User') }"
if errorlevel 1 exit /b 1

echo Node.js PowerShell configuration is ready.
echo Close all PowerShell windows, open a new one, and run:
echo   node --version
echo   npm --version
echo   pnpm --version
exit /b 0
