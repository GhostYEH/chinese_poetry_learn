@echo off
title Chinese Poetry System - Browser Version

echo ========================================
echo    Chinese Poetry Learning System
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js not found, please install Node.js first!
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js is installed
node -v
echo.

echo [2/3] Starting backend server...
cd backend
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
)

echo.
echo Starting server, please wait...
start "Chinese Poetry Backend" cmd /k "node server.js"

echo Backend server is starting...
echo.

echo [3/3] Waiting for server to start...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo    STARTED SUCCESSFULLY!
echo ========================================
echo.
echo Opening browser...
start http://localhost:3000
echo.
echo Backend log window is open, do not close it!
echo To stop, close the backend window or press Ctrl+C
echo.
pause
