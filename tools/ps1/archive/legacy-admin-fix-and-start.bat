@echo off

chcp 65001 >nul 2>&1



echo [DEPRECATED] This legacy script is archived.

echo Use: tools\ps1\network\one-click-network-fix.bat

echo.



:: Request admin

net session >nul 2>&1

if %errorLevel% neq 0 (

  echo 正在请求管理员权限...

  powershell -Command "Start-Process '%~f0' -Verb RunAs"

  exit /b

)



cd /d "%~dp0"



call "..\network\one-click-network-fix.bat"



pause









