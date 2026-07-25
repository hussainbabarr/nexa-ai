@echo off
title Nexa AI Setup
cd /d "%~dp0"

echo Installing Nexa AI dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo Installation failed. Make sure Node.js 20 or newer is installed.
  pause
  exit /b 1
)

if not exist "server\.env" (
  copy "server\.env.example" "server\.env" >nul
)

echo.
echo Setup complete.
echo Open server\.env in VS Code and add your NEW Groq key.
echo An OpenAI image key is optional and is only needed for image generation.
echo Never share your key in chat or upload server\.env to GitHub.
pause
