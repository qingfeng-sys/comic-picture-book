# 启动开发服务器（网络访问）
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Host "检测 IP 地址..." -ForegroundColor Yellow
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and ($_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*") } | Select-Object -First 1 -ExpandProperty IPAddress

if ($ips) {
    Write-Host "IP: $ips" -ForegroundColor Green
    Write-Host "访问: http://$ips:3000" -ForegroundColor Cyan
    
    if (-not $isAdmin) {
        Write-Host ""
        Write-Host "提示: 如需创建防火墙规则，请以管理员身份运行:" -ForegroundColor Yellow
        Write-Host "New-NetFirewallRule -DisplayName 'Next.js Port 3000' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any" -ForegroundColor Gray
        Write-Host ""
    } else {
        $rule = Get-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" -ErrorAction SilentlyContinue
        if (-not $rule) {
            try {
                New-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any -ErrorAction Stop | Out-Null
                Write-Host "防火墙规则已创建" -ForegroundColor Green
            } catch {
                Write-Host "创建防火墙规则失败" -ForegroundColor Red
            }
        }
    }
    Write-Host ""
    npx next dev -H $ips
} else {
    Write-Host "未找到 IP，使用标准方式启动" -ForegroundColor Yellow
    Write-Host ""
    npm run dev
}

