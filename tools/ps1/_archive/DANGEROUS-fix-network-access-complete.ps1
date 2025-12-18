# 完整的网络访问修复脚本
# 自动检测并修复所有网络访问问题

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   网络访问完整修复工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "需要管理员权限来设置防火墙规则" -ForegroundColor Yellow
    Write-Host "正在请求管理员权限..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# 1. 设置防火墙规则
Write-Host "[1/4] 设置 Windows 防火墙规则..." -ForegroundColor Yellow
try {
    $existingRule = Get-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" -ErrorAction SilentlyContinue
    if ($existingRule) {
        Remove-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" -ErrorAction SilentlyContinue
        Write-Host "  已删除旧规则" -ForegroundColor Gray
    }
    
    New-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" `
        -Direction Inbound `
        -LocalPort 3000 `
        -Protocol TCP `
        -Action Allow `
        -Profile Any `
        -ErrorAction Stop | Out-Null
    
    Write-Host "  防火墙规则创建成功" -ForegroundColor Green
} catch {
    Write-Host "  防火墙规则创建失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. 检查并修复 package.json
Write-Host "[2/4] 检查 package.json 配置..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    try {
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        $needsFix = $false
        
        if ($packageJson.scripts.dev -notlike "*0.0.0.0*" -and $packageJson.scripts.dev -notlike "*-H 0.0.0.0*") {
            $packageJson.scripts.dev = "next dev -H 0.0.0.0"
            $needsFix = $true
            Write-Host "  修复 dev 脚本配置" -ForegroundColor Gray
        }
        
        if ($packageJson.scripts.start -notlike "*0.0.0.0*" -and $packageJson.scripts.start -notlike "*-H 0.0.0.0*") {
            $packageJson.scripts.start = "next start -H 0.0.0.0"
            $needsFix = $true
            Write-Host "  修复 start 脚本配置" -ForegroundColor Gray
        }
        
        if ($needsFix) {
            $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json" -Encoding UTF8
            Write-Host "  package.json 已更新" -ForegroundColor Green
        } else {
            Write-Host "  package.json 配置正确" -ForegroundColor Green
        }
    } catch {
        Write-Host "  读取或修改 package.json 失败: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  未找到 package.json" -ForegroundColor Red
}

# 3. 检查 next.config.js
Write-Host "[3/4] 检查 next.config.js 配置..." -ForegroundColor Yellow
if (Test-Path "next.config.js") {
    Write-Host "  next.config.js 存在（网络访问不需要特殊配置）" -ForegroundColor Green
    Write-Host "  注意：Next.js 16.0.7 不支持 allowedDevOrigins，已通过其他方式实现网络访问" -ForegroundColor Gray
} else {
    Write-Host "  未找到 next.config.js" -ForegroundColor Yellow
}

# 4. 显示网络 IP 地址
Write-Host "[4/4] 检测网络 IP 地址..." -ForegroundColor Yellow
try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
        $_.IPAddress -notlike "127.*" -and 
        ($_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*") 
    } | Select-Object -ExpandProperty IPAddress

    if ($ips) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "修复完成！" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "请使用以下地址从其他设备访问:" -ForegroundColor Yellow
        foreach ($ip in $ips) {
            Write-Host "  http://$ip:3000" -ForegroundColor Cyan
        }
        Write-Host ""
        Write-Host "重要提示:" -ForegroundColor Yellow
        Write-Host "1. 不要使用 http://0.0.0.0:3000 访问（这是监听地址，不是访问地址）" -ForegroundColor Gray
        Write-Host "2. 确保服务器已启动: npm run dev" -ForegroundColor Gray
        Write-Host "3. 确保客户端设备与服务器在同一网络" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "  未找到局域网 IP 地址" -ForegroundColor Yellow
        Write-Host "  请确保已连接到网络" -ForegroundColor Gray
    }
} catch {
    Write-Host "  检测 IP 地址失败: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
