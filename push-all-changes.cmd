@echo off
setlocal

cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: This script must be located inside a Git repository.
  exit /b 1
)

set "COMMIT_MESSAGE=%~1"
if not defined COMMIT_MESSAGE set "COMMIT_MESSAGE=Sync local changes"

git config user.name >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git user.name is not configured.
  echo Run: git config user.name "Your Name"
  exit /b 1
)

git config user.email >nul 2>&1
if errorlevel 1 (
  echo ERROR: Git user.email is not configured.
  echo Run: git config user.email "you@example.com"
  exit /b 1
)

echo Fetching the latest remote state...
git fetch origin
if errorlevel 1 exit /b 1

git show-ref --verify --quiet refs/remotes/origin/main
if not errorlevel 1 (
  echo Rebasing local changes onto origin/main...
  git pull --rebase --autostash origin main
  if errorlevel 1 exit /b 1
)

echo Staging all local changes...
git add --all
if errorlevel 1 exit /b 1

git diff --cached --quiet
if errorlevel 1 (
  echo Creating commit: %COMMIT_MESSAGE%
  git commit -m "%COMMIT_MESSAGE%"
  if errorlevel 1 exit /b 1
) else (
  echo No new local changes need to be committed.
)

echo Pushing main to origin...
git push --set-upstream origin main
if errorlevel 1 exit /b 1

echo Push completed successfully.
exit /b 0
