@echo off
title Nexa AI - Build Android APK
set "NEXA_PROJECT_ROOT=%~dp0"
cd /d "%NEXA_PROJECT_ROOT%"

echo Checking and installing project dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo Dependency installation failed.
  echo Make sure Node.js 20 or newer is installed, then run this file again.
  pause
  exit /b 1
)

if not exist "%NEXA_PROJECT_ROOT%node_modules\expo-font\package.json" (
  if not exist "%NEXA_PROJECT_ROOT%mobile\node_modules\expo-font\package.json" (
    echo.
    echo expo-font was not installed correctly.
    echo Run 1-INSTALL.bat, then try this build again.
    pause
    exit /b 1
  )
)

if not exist ".git" (
  echo Initializing the project repository...
  git init
  echo.
)

cd /d "%NEXA_PROJECT_ROOT%mobile"

echo Validating Expo configuration...
call npx expo config --type public >nul
if errorlevel 1 (
  echo.
  echo Expo configuration validation failed.
  echo Run 1-INSTALL.bat, then try this build again.
  pause
  exit /b 1
)

echo Building an installable Nexa AI APK with Expo EAS...
echo Sign in to your Expo account if asked.
echo Build root: mobile
echo.

call npx eas-cli build --platform android --profile preview

echo.
echo When the build finishes, open the download link shown above.
pause
