@echo off
title Nexa AI - Push to GitHub
set "NEXA_PROJECT_ROOT=%~dp0"
cd /d "%NEXA_PROJECT_ROOT%"

where git >nul 2>&1
if errorlevel 1 (
  echo Git is not installed or is not available in PATH.
  echo Install Git for Windows, then run this file again.
  pause
  exit /b 1
)

if not exist ".git" (
  echo Initializing Git repository...
  git init
)

git config user.name "Hussain Babar"
git config user.email "hussainbabarr@users.noreply.github.com"

echo Preparing safe source files...
git add .
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Initial Nexa AI release"
  if errorlevel 1 (
    echo.
    echo Git could not create the commit.
    pause
    exit /b 1
  )
)

git branch -M main
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/hussainbabarr/nexa-ai.git
) else (
  git remote set-url origin https://github.com/hussainbabarr/nexa-ai.git
)

echo.
echo Uploading Nexa AI to GitHub...
git push -u origin main
if errorlevel 1 (
  echo.
  echo Upload did not complete. Sign in to GitHub if prompted, then run this file again.
  pause
  exit /b 1
)

echo.
echo Upload complete:
echo https://github.com/hussainbabarr/nexa-ai
pause
