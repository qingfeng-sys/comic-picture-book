# 网络访问诊断脚本
Write-Host "=== Next.js 网络访问诊断 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 IP 地址
Write-Host "1. 检查网络 IP 地址..." -ForegroundColor Yellow
$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike '127.*' -and
    ($_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' -or $_.IPAddress -like '172.*')
} | Select-Object IPAddress, InterfaceAlias

if ($ipAddresses) {
    Write-Host "   找到以下 IP 地址:" -ForegroundColor Green
    foreach ($ip in $ipAddresses) {
        Write-Host "   - $($ip.IPAddress) ($($ip.InterfaceAlias))" -ForegroundColor Cyan
        Write-Host "     访问地址: http://$($ip.IPAddress):3000" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ 未找到局域网 IP 地址" -ForegroundColor Red
    Write-Host "   请检查网络连接" -ForegroundColor Yellow
}
Write-Host ""

# 2. 检查端口 3000 状态
Write-Host "2. 检查端口 3000 状态..." -ForegroundColor Yellow
$port = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port) {
    Write-Host "   ✓ 端口 3000 正在使用" -ForegroundColor Green
    Write-Host "   监听地址: $($port.LocalAddress)" -ForegroundColor Gray
    Write-Host "   状态: $($port.State)" -ForegroundColor Gray
    
    if ($port.LocalAddress -eq "0.0.0.0" -or $port.LocalAddress -eq "::") {
        Write-Host "   ✓ 服务器已绑定到所有网络接口" -ForegroundColor Green
    } elseif ($port.LocalAddress -eq "127.0.0.1") {
        Write-Host "   ✗ 服务器只绑定到 localhost，无法从网络访问" -ForegroundColor Red
        Write-Host "   请使用 'npm run dev' 启动（已配置 -H 0.0.0.0）" -ForegroundColor Yellow
    } else {
        Write-Host "   服务器绑定到: $($port.LocalAddress)" -ForegroundColor Gray
    }
} else {
    Write-Host "   ✗ 端口 3000 未被占用" -ForegroundColor Red
    Write-Host "   服务器可能未运行，请执行: npm run dev" -ForegroundColor Yellow
}
Write-Host ""

# 3. 检查防火墙规则
Write-Host "3. 检查 Windows 防火墙..." -ForegroundColor Yellow
$firewallRules = Get-NetFirewallRule | Where-Object {
    $_.DisplayName -like "*3000*" -or 
    ($_.DisplayName -like "*Next.js*" -and $_.DisplayName -like "*3000*")
} | Select-Object DisplayName, Enabled, Direction, Action

if ($firewallRules) {
    Write-Host "   找到以下防火墙规则:" -ForegroundColor Green
    foreach ($rule in $firewallRules) {
        $status = if ($rule.Enabled) { "✓ 已启用" } else { "✗ 已禁用" }
        $color = if ($rule.Enabled) { "Green" } else { "Red" }
        Write-Host "   - $($rule.DisplayName): $status ($($rule.Direction), $($rule.Action))" -ForegroundColor $color
    }
} else {
    Write-Host "   ⚠ 未找到端口 3000 的防火墙规则" -ForegroundColor Yellow
    Write-Host "   这可能是无法访问的原因！" -ForegroundColor Red
    Write-Host ""
    Write-Host "   创建防火墙规则（需要管理员权限）:" -ForegroundColor Yellow
    Write-Host "   New-NetFirewallRule -DisplayName 'Next.js Dev Server Port 3000' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any" -ForegroundColor Gray
}
Write-Host ""

# 4. 检查 package.json 配置
Write-Host "4. 检查 package.json 配置..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    if ($pkg.scripts.dev -match "-H 0\.0\.0\.0") {
        Write-Host "   ✓ package.json 配置正确（监听所有接口）" -ForegroundColor Green
    } else {
        Write-Host "   ✗ package.json 配置不正确" -ForegroundColor Red
        Write-Host "   应该包含: 'next dev -H 0.0.0.0'" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✗ package.json 文件不存在" -ForegroundColor Red
}
Write-Host ""

# 5. 总结和建议
Write-Host "=== 诊断结果 ===" -ForegroundColor Cyan
Write-Host ""

if ($ipAddresses -and $port -and ($port.LocalAddress -eq "0.0.0.0" -or $port.LocalAddress -eq "::")) {
    Write-Host "服务器配置: ✓ 正确" -ForegroundColor Green
    Write-Host "网络绑定: ✓ 已绑定到所有接口" -ForegroundColor Green
    
    if ($firewallRules -and ($firewallRules | Where-Object { $_.Enabled -eq $true })) {
        Write-Host "防火墙: ✓ 已配置" -ForegroundColor Green
        Write-Host ""
        Write-Host "如果仍然无法访问，请尝试:" -ForegroundColor Yellow
        Write-Host "1. 确认访问设备在同一局域网" -ForegroundColor White
        Write-Host "2. 确认 IP 地址正确（使用上面显示的 IP）" -ForegroundColor White
        Write-Host "3. 检查路由器是否允许设备间通信" -ForegroundColor White
    } else {
        Write-Host "防火墙: ✗ 未配置或已禁用" -ForegroundColor Red
        Write-Host ""
        Write-Host "⚠ 这是最可能的问题！" -ForegroundColor Red
        Write-Host "请以管理员身份运行以下命令创建防火墙规则:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "New-NetFirewallRule -DisplayName 'Next.js Dev Server Port 3000' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any" -ForegroundColor Cyan
    }
} else {
    Write-Host "发现问题:" -ForegroundColor Yellow
    if (-not $ipAddresses) {
        Write-Host "- 未找到网络 IP 地址" -ForegroundColor Red
    }
    if (-not $port) {
        Write-Host "- 服务器未运行" -ForegroundColor Red
    }
    if ($port -and $port.LocalAddress -eq "127.0.0.1") {
        Write-Host "- 服务器未绑定到网络接口" -ForegroundColor Red
    }
}

Write-Host ""









