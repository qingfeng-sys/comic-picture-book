@echo off
chcp 65001 >nul
echo ========================================
echo   设置 Windows 防火墙规则
echo ========================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 正在请求管理员权限...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo 创建防火墙规则...
powershell -Command "try { New-NetFirewallRule -DisplayName 'Next.js Dev Server Port 3000' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any -ErrorAction Stop; Write-Host '防火墙规则创建成功！' -ForegroundColor Green } catch { Write-Host '创建失败: ' -ForegroundColor Red; Write-Host $_.Exception.Message -ForegroundColor Red }"

echo.
pause

