@echo off

chcp 65001 >nul 2>&1



:: 检查管理员权限

net session >nul 2>&1

if %errorLevel% neq 0 (

  echo 正在请求管理员权限...

  powershell -Command "Start-Process '%~f0' -Verb RunAs"

  exit /b

)



cls

echo ========================================

echo   一键修复网络访问问题

echo ========================================

echo ========================================

echo.

echo 此脚本将：

echo 1. 配置 Windows 防火墙入站规则（端口 3000）

echo 2. 输出可用的局域网访问地址

echo 3. 启动开发服务器（npm run dev）

echo.

pause



cd /d "%~dp0"



powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-network.ps1"

echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\dev\start-dev.ps1"



pause

