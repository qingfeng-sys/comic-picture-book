@echo off
chcp 65001 >nul 2>&1
cls
echo ========================================
echo   网络访问问题诊断工具
echo ========================================
echo.

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0diagnose-network-access.ps1"

pause
