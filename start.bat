@echo off
echo ========================================
echo    Chinese Poetry System - Dev Mode
echo ========================================
echo.

cd /d "%~dp0"

if not exist "backend\server.js" (
    echo Error: Backend server file not found
    echo Please run this script from project root
    pause
    exit /b 1
)

echo [1/2] Starting backend server...
cd backend
start "Backend Server" cmd /k "node server.js"
cd ..

echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

echo.
echo [2/2] Starting frontend dev server...
cd frontend
start "Frontend Dev Server" cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo Development environment started!
echo ========================================
echo.
echo Backend server: http://localhost:3000
echo Frontend dev server: http://localhost:5173
echo.
echo Browser will open automatically
echo.
echo Press any key to close this window...
pause >nul
