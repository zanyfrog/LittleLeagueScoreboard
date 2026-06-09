@echo off
setlocal

cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: This script must be located inside a Git repository.
  exit /b 1
)

echo Fetching changes from origin...
git fetch origin
if errorlevel 1 exit /b 1

git show-ref --verify --quiet refs/remotes/origin/main
if errorlevel 1 (
  echo No remote main branch exists yet. Nothing to pull.
  exit /b 0
)

echo Applying origin/main to the local main branch...
git pull --rebase --autostash origin main
if errorlevel 1 exit /b 1

echo Pull completed successfully.
exit /b 0
