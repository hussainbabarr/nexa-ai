@echo off
title Start Nexa AI
cd /d "%~dp0"

if not exist "node_modules" (
  echo Dependencies are missing. Run 1-INSTALL.bat first.
  pause
  exit /b 1
)

if not exist "server\.env" (
  echo server\.env is missing. Run 1-INSTALL.bat first.
  pause
  exit /b 1
)

start "Nexa AI Backend" cmd /k "cd /d ""%~dp0"" && npm run server"
timeout /t 2 /nobreak >nul
start "Nexa AI Mobile" cmd /k "cd /d ""%~dp0"" && npm run mobile"

echo Nexa AI backend and mobile development server are starting.
timeout /t 3 /nobreak >nul
