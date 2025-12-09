@echo off
chcp 65001 >nul 2>&1
cls
echo ========================================
echo   一键修复网络访问问题
echo ========================================
echo.
echo 此脚本将：
echo 1. 设置 Windows 防火墙规则
echo 2. 检查并修复 package.json 配置
echo 3. 显示你的网络 IP 地址
echo.
echo 需要管理员权限！
echo.
pause

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-network-access-complete.ps1"

pause
