# 修复网络访问问题脚本
Write-Host "=== 修复 Next.js 网络访问问题 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查当前 IP 地址
Write-Host "1. 检查当前网络配置..." -ForegroundColor Yellow
$ipConfig = ipconfig | Select-String -Pattern "IPv4" -Context 0,1
Write-Host "   当前 IP 配置:" -ForegroundColor White
$ipConfig | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }

# 2. 检查端口 3000 是否被占用
Write-Host ""
Write-Host "2. 检查端口 3000 状态..." -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host "   ✓ 端口 3000 正在使用" -ForegroundColor Green
    Write-Host "   监听地址: $($port3000.LocalAddress)" -ForegroundColor Gray
    Write-Host "   状态: $($port3000.State)" -ForegroundColor Gray
    
    if ($port3000.LocalAddress -eq "0.0.0.0" -or $port3000.LocalAddress -eq "::") {
        Write-Host "   ✓ 服务器已正确绑定到所有网络接口" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ 服务器未绑定到 0.0.0.0，当前绑定: $($port3000.LocalAddress)" -ForegroundColor Yellow
        Write-Host "   请确保使用 'npm run dev' 启动服务器" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✗ 端口 3000 未被占用，服务器可能未运行" -ForegroundColor Red
    Write-Host "   请运行: npm run dev" -ForegroundColor Yellow
}

# 3. 检查防火墙规则
Write-Host ""
Write-Host "3. 检查 Windows 防火墙规则..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" -ErrorAction SilentlyContinue
if ($firewallRule) {
    Write-Host "   ✓ 防火墙规则已存在" -ForegroundColor Green
} else {
    Write-Host "   ⚠ 未找到防火墙规则，正在创建..." -ForegroundColor Yellow
    
    try {
        # 创建入站规则允许端口 3000
        New-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" `
            -Direction Inbound `
            -LocalPort 3000 `
            -Protocol TCP `
            -Action Allow `
            -Profile Any `
            -ErrorAction Stop
        
        Write-Host "   ✓ 防火墙规则创建成功" -ForegroundColor Green
    } catch {
        Write-Host "   ✗ 创建防火墙规则失败: $_" -ForegroundColor Red
        Write-Host "   请以管理员身份运行此脚本" -ForegroundColor Yellow
    }
}

# 4. 验证 package.json 配置
Write-Host ""
Write-Host "4. 验证 package.json 配置..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $packageContent = Get-Content "package.json" -Raw
    if ($packageContent -match 'next dev -H 0\.0\.0\.0') {
        Write-Host "   ✓ package.json 配置正确" -ForegroundColor Green
    } else {
        Write-Host "   ✗ package.json 配置不正确" -ForegroundColor Red
        Write-Host "   应该包含: 'next dev -H 0.0.0.0'" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✗ package.json 文件不存在" -ForegroundColor Red
}

# 5. 提供下一步操作建议
Write-Host ""
Write-Host "=== 修复完成 ===" -ForegroundColor Green
Write-Host ""
Write-Host "下一步操作:" -ForegroundColor Yellow
Write-Host "1. 如果服务器未运行，请执行: npm run dev" -ForegroundColor White
Write-Host "2. 启动后，查看终端输出，应该显示:" -ForegroundColor White
Write-Host "   - Local:        http://localhost:3000" -ForegroundColor Gray
Write-Host "   - Network:      http://192.168.1.x:3000" -ForegroundColor Gray
Write-Host "3. 在同一网络的其他设备上访问显示的 Network 地址" -ForegroundColor White
Write-Host "4. 如果仍然无法访问，请检查:" -ForegroundColor White
Write-Host "   - 设备是否在同一局域网" -ForegroundColor Gray
Write-Host "   - 防火墙是否允许连接（可能需要管理员权限）" -ForegroundColor Gray
Write-Host "   - 路由器是否阻止了设备间通信" -ForegroundColor Gray
Write-Host ""


