@echo off
chcp 65001 >nul
title Chinese Poetry Learning System

echo ========================================
echo    Chinese Poetry Learning System
echo ========================================
echo.

cd /d "%~dp0"

echo Starting development server...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Press Ctrl+C to stop all services
echo ========================================
echo.

npm run dev
