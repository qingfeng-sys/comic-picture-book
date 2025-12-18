# 使用实际 IP 地址启动 Next.js 开发服务器
Write-Host "=== 使用实际 IP 启动 Next.js 开发服务器 ===" -ForegroundColor Cyan
Write-Host ""

# 获取本机 IP 地址
Write-Host "检测网络 IP 地址..." -ForegroundColor Yellow
$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike '127.*' -and
    ($_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' -or $_.IPAddress -like '172.*')
} | Select-Object -First 1 -ExpandProperty IPAddress

if ($ipAddresses) {
    Write-Host "找到 IP 地址: $ipAddresses" -ForegroundColor Green
    Write-Host "服务器将绑定到: $ipAddresses" -ForegroundColor Cyan
    Write-Host "访问地址: http://$ipAddresses:3000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "启动开发服务器..." -ForegroundColor Yellow
    Write-Host ""
    
    # 使用实际 IP 启动
    npx next dev -H $ipAddresses
} else {
    Write-Host "✗ 未找到局域网 IP 地址" -ForegroundColor Red
    Write-Host "回退到监听所有接口 (0.0.0.0)..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "提示: 启动后，请使用 ipconfig 查找你的 IP 地址" -ForegroundColor Yellow
    Write-Host ""
    
    # 回退到 0.0.0.0
    npm run dev
}









