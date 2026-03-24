@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    Electron Build Script
echo ========================================
echo.

cd /d "%~dp0"

echo [Step 1/4] Checking frontend build...
if not exist "backend\public\index.html" (
    echo Frontend not built, building now...
    cd frontend
    call npm install
    call npm run build
    cd ..
    if errorlevel 1 (
        echo Frontend build failed!
        pause
        exit /b 1
    )
) else (
    echo Frontend already built, skipping...
)

echo.
echo [Step 2/4] Checking backend dependencies...
cd backend
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
    if errorlevel 1 (
        echo Backend dependencies installation failed!
        pause
        exit /b 1
    )
) else (
    echo Backend dependencies exist, skipping...
)
cd ..

echo.
echo [Step 3/4] Checking Electron dependencies...
cd electron
if not exist "node_modules" (
    echo Installing Electron dependencies...
    set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    call npm install
    if errorlevel 1 (
        echo Electron dependencies installation failed!
        pause
        exit /b 1
    )
) else (
    echo Electron dependencies exist, skipping...
)

echo.
echo [Step 4/4] Building Electron application...
echo This may take several minutes, please wait...
echo.
call npm run build:win
if errorlevel 1 (
    echo.
    echo Electron build failed!
    echo Please check the error message above.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo Output location: %cd%\dist
echo.
echo Generated files:
if exist "dist\古诗词学习系统 Setup 1.0.0.exe" (
    echo - Installer: 古诗词学习系统 Setup 1.0.0.exe
)
if exist "dist\win-unpacked" (
    echo - Portable: dist\win-unpacked\
)
echo.
echo Next steps:
echo 1. Test the application
echo 2. Distribute to users
echo.
pause
