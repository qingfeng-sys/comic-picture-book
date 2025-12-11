@echo off
chcp 65001 >nul
echo ========================================
echo   启动 Next.js 开发服务器
echo ========================================
echo.

cd /d "%~dp0"

echo 检查防火墙规则...
powershell -Command "$rule = Get-NetFirewallRule -DisplayName 'Next.js Dev Server Port 3000' -ErrorAction SilentlyContinue; if (-not $rule) { Write-Host '未找到防火墙规则' -ForegroundColor Yellow; Write-Host '提示: 如果无法从网络访问，请以管理员身份运行以下命令:' -ForegroundColor Yellow; Write-Host 'New-NetFirewallRule -DisplayName \"Next.js Dev Server Port 3000\" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any' -ForegroundColor Gray } else { Write-Host '防火墙规则已存在' -ForegroundColor Green }"

echo.
echo 启动开发服务器...
echo.

call npm run dev

pause



