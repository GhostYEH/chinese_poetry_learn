@echo off
title Poetry Learning System

echo ========================================
echo     Poetry Learning System
echo ========================================
echo.

cd /d "%~dp0backend"
start "" http://localhost:3000
"%~dp0nodejs\node.exe" server.js

pause
