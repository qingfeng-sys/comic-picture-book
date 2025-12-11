# 启动 Next.js 开发服务器并显示正确的网络 IP 地址
Write-Host "=== 启动 Next.js 开发服务器（网络访问） ===" -ForegroundColor Cyan
Write-Host ""

# 获取本机 IP 地址
Write-Host "检测网络 IP 地址..." -ForegroundColor Yellow
$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -like "192.168.*" -or 
    $_.IPAddress -like "10.*" -or 
    $_.IPAddress -like "172.*"
} | Select-Object -ExpandProperty IPAddress

if ($ipAddresses) {
    Write-Host "找到以下 IP 地址:" -ForegroundColor Green
    foreach ($ip in $ipAddresses) {
        Write-Host "  - http://$ip:3000" -ForegroundColor Cyan
    }
    Write-Host ""
} else {
    Write-Host "⚠ 未找到局域网 IP 地址" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "启动开发服务器..." -ForegroundColor Yellow
Write-Host "提示: 服务器启动后，请使用上面显示的 IP 地址访问，而不是 0.0.0.0" -ForegroundColor Yellow
Write-Host ""

# 启动 Next.js 开发服务器
npm run dev



