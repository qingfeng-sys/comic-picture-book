# 网络访问问题诊断脚本
# 检查所有可能导致网络访问失败的问题

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   网络访问问题诊断工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 Node.js 和 Next.js
Write-Host "[1/6] 检查 Node.js 环境..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js 未安装或不在 PATH 中" -ForegroundColor Red
    exit 1
}

# 2. 检查端口占用
Write-Host "[2/6] 检查端口 3000 占用情况..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    $process = Get-Process -Id $port3000.OwningProcess -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "  ⚠ 端口 3000 已被占用: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Yellow
        Write-Host "  提示: 请先停止该进程，或使用其他端口" -ForegroundColor Gray
    } else {
        Write-Host "  ✓ 端口 3000 可用" -ForegroundColor Green
    }
} else {
    Write-Host "  ✓ 端口 3000 可用" -ForegroundColor Green
}

# 3. 检查防火墙规则
Write-Host "[3/6] 检查 Windows 防火墙规则..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" -ErrorAction SilentlyContinue
if ($firewallRule) {
    $ruleEnabled = ($firewallRule | Where-Object { $_.Enabled -eq $true })
    if ($ruleEnabled) {
        Write-Host "  ✓ 防火墙规则已存在并启用" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ 防火墙规则存在但未启用" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✗ 防火墙规则不存在" -ForegroundColor Red
    Write-Host "  提示: 需要以管理员身份运行 '设置防火墙.bat' 或执行以下命令:" -ForegroundColor Gray
    Write-Host "  New-NetFirewallRule -DisplayName 'Next.js Dev Server Port 3000' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any" -ForegroundColor Gray
}

# 4. 检查网络 IP 地址
Write-Host "[4/6] 检查本机网络 IP 地址..." -ForegroundColor Yellow
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -notlike "127.*" -and 
    ($_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*") 
} | Select-Object -ExpandProperty IPAddress

if ($ips) {
    Write-Host "  找到以下网络 IP 地址:" -ForegroundColor Green
    foreach ($ip in $ips) {
        Write-Host "    - http://$ip:3000" -ForegroundColor Cyan
    }
} else {
    Write-Host "  ⚠ 未找到局域网 IP 地址" -ForegroundColor Yellow
    Write-Host "  提示: 请确保已连接到网络" -ForegroundColor Gray
}

# 5. 检查 package.json 配置
Write-Host "[5/6] 检查 package.json 启动配置..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $devScript = $packageJson.scripts.dev
    if ($devScript -like "*0.0.0.0*" -or $devScript -like "*-H 0.0.0.0*") {
        Write-Host "  ✓ dev 脚本已配置为监听 0.0.0.0" -ForegroundColor Green
    } else {
        Write-Host "  ✗ dev 脚本未配置为监听 0.0.0.0" -ForegroundColor Red
        Write-Host "  当前配置: $devScript" -ForegroundColor Gray
        Write-Host "  应该改为: next dev -H 0.0.0.0" -ForegroundColor Gray
    }
} else {
    Write-Host "  ✗ 未找到 package.json" -ForegroundColor Red
}

# 6. 检查 next.config.js
Write-Host "[6/6] 检查 next.config.js 配置..." -ForegroundColor Yellow
if (Test-Path "next.config.js") {
    Write-Host "  ✓ next.config.js 存在" -ForegroundColor Green
    Write-Host "  注意：Next.js 16.0.7 不支持 allowedDevOrigins，网络访问通过其他方式实现" -ForegroundColor Gray
} else {
    Write-Host "  ⚠ 未找到 next.config.js" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "诊断完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "如果所有检查都通过但仍无法访问，请尝试:" -ForegroundColor Yellow
Write-Host "1. 完全停止服务器（Ctrl+C），然后重新启动" -ForegroundColor Gray
Write-Host "2. 使用实际 IP 地址访问，不要使用 0.0.0.0" -ForegroundColor Gray
Write-Host "3. 确保客户端设备与服务器在同一网络" -ForegroundColor Gray
Write-Host "4. 检查路由器防火墙设置" -ForegroundColor Gray
Write-Host ""
