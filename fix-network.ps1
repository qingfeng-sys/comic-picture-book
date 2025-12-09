# 网络访问修复脚本
Write-Host "=== Next.js 网络访问修复 ===" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# 显示 IP 地址
Write-Host "检测网络 IP 地址..." -ForegroundColor Yellow
$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and
    ($_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*")
} | Select-Object IPAddress, InterfaceAlias

if ($ipAddresses) {
    Write-Host "找到以下 IP 地址:" -ForegroundColor Green
    foreach ($ip in $ipAddresses) {
        Write-Host "  - $($ip.IPAddress) ($($ip.InterfaceAlias))" -ForegroundColor Cyan
        Write-Host "    访问地址: http://$($ip.IPAddress):3000" -ForegroundColor Gray
    }
} else {
    Write-Host "未找到局域网 IP 地址" -ForegroundColor Yellow
}
Write-Host ""

# 检查防火墙规则
Write-Host "检查防火墙规则..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" -ErrorAction SilentlyContinue

if ($firewallRule) {
    Write-Host "防火墙规则已存在" -ForegroundColor Green
} else {
    if ($isAdmin) {
        try {
            New-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any -ErrorAction Stop
            Write-Host "防火墙规则创建成功" -ForegroundColor Green
        } catch {
            Write-Host "创建防火墙规则失败: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "需要管理员权限创建防火墙规则" -ForegroundColor Red
        Write-Host "请以管理员身份运行此脚本" -ForegroundColor Yellow
    }
}
Write-Host ""

# 启动服务器
Write-Host "启动开发服务器..." -ForegroundColor Yellow
if ($ipAddresses) {
    $selectedIP = $ipAddresses[0].IPAddress
    Write-Host "访问地址: http://$selectedIP:3000" -ForegroundColor Cyan
    Write-Host ""
    npx next dev -H $selectedIP
} else {
    Write-Host "使用标准方式启动..." -ForegroundColor Yellow
    Write-Host ""
    npm run dev
}


