@echo off
chcp 936 >nul
title Stop Poetry Learning System

echo ========================================
echo     Poetry Learning System - Stopping...
echo ========================================
echo.

echo Stopping Node.js process...
taskkill /f /im node.exe 2>nul
if errorlevel 1 (
    echo No running Node.js process found.
) else (
    echo Node.js process stopped.
)

echo.
echo ========================================
echo     System stopped.
echo ========================================
echo.

pause
