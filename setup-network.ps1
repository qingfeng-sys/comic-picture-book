# 设置 Next.js 网络访问
Write-Host "=== 设置 Next.js 网络访问 ===" -ForegroundColor Cyan
Write-Host ""

# 检查是否以管理员身份运行
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠ 警告: 未以管理员身份运行" -ForegroundColor Yellow
    Write-Host "   某些操作可能需要管理员权限" -ForegroundColor Yellow
    Write-Host ""
}

# 1. 创建防火墙规则（如果不存在）
Write-Host "1. 配置 Windows 防火墙..." -ForegroundColor Yellow
$ruleName = "Next.js Dev Server Port 3000"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "   ✓ 防火墙规则已存在" -ForegroundColor Green
} else {
    if ($isAdmin) {
        try {
            New-NetFirewallRule -DisplayName $ruleName `
                -Direction Inbound `
                -LocalPort 3000 `
                -Protocol TCP `
                -Action Allow `
                -Profile Any `
                -ErrorAction Stop
            Write-Host "   ✓ 防火墙规则创建成功" -ForegroundColor Green
        } catch {
            Write-Host "   ✗ 创建防火墙规则失败: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "   ⚠ 需要管理员权限创建防火墙规则" -ForegroundColor Yellow
        Write-Host "   请以管理员身份运行此脚本，或手动创建防火墙规则" -ForegroundColor Yellow
    }
}

# 2. 显示当前 IP 地址
Write-Host ""
Write-Host "2. 当前网络 IP 地址:" -ForegroundColor Yellow
$adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*" }
if ($adapters) {
    foreach ($adapter in $adapters) {
        Write-Host "   - $($adapter.IPAddress)" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠ 未找到局域网 IP 地址" -ForegroundColor Yellow
}

# 3. 验证配置
Write-Host ""
Write-Host "3. 验证配置..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    if ($pkg.scripts.dev -match "-H 0\.0\.0\.0") {
        Write-Host "   ✓ package.json 配置正确" -ForegroundColor Green
    } else {
        Write-Host "   ✗ package.json 配置不正确" -ForegroundColor Red
    }
}

# 4. 检查服务器状态
Write-Host ""
Write-Host "4. 检查服务器状态..." -ForegroundColor Yellow
$port = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port) {
    Write-Host "   ✓ 端口 3000 正在使用" -ForegroundColor Green
    Write-Host "   监听地址: $($port.LocalAddress)" -ForegroundColor Gray
    if ($port.LocalAddress -eq "0.0.0.0" -or $port.LocalAddress -eq "::") {
        Write-Host "   ✓ 服务器已绑定到所有网络接口" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠ 端口 3000 未被占用" -ForegroundColor Yellow
    Write-Host "   服务器可能未运行" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 设置完成 ===" -ForegroundColor Green
Write-Host ""
Write-Host "重要提示:" -ForegroundColor Yellow
Write-Host "1. 请确保开发服务器正在运行: npm run dev" -ForegroundColor White
Write-Host "2. 启动后应该看到 Network 地址，例如: http://192.168.1.199:3000" -ForegroundColor White
Write-Host "3. 如果防火墙规则创建失败，请以管理员身份运行此脚本" -ForegroundColor White
Write-Host "4. 或者手动在 Windows 防火墙中添加端口 3000 的入站规则" -ForegroundColor White
Write-Host ""









