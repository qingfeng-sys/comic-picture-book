# 诊断和修复脚本
Write-Host "=== 诊断和修复脚本 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查 .env.local 文件
Write-Host "1. 检查 .env.local 文件..." -ForegroundColor Yellow
$envFile = ".env.local"
$apiKey = "sk-7184f5ee339047b98aff5b1d7d1e2b81"

if (Test-Path $envFile) {
    Write-Host "   ✓ 文件存在" -ForegroundColor Green
    $content = Get-Content $envFile -Raw -ErrorAction SilentlyContinue
    if ($content -and $content -match "DEEPSEEK_API_KEY") {
        Write-Host "   ✓ 包含 DEEPSEEK_API_KEY" -ForegroundColor Green
        if ($content -match "DEEPSEEK_API_KEY\s*=\s*sk-") {
            Write-Host "   ✓ API密钥格式正确" -ForegroundColor Green
        } else {
            Write-Host "   ⚠ API密钥格式可能有问题，正在修复..." -ForegroundColor Yellow
            "DEEPSEEK_API_KEY=$apiKey" | Out-File -FilePath $envFile -Encoding utf8 -NoNewline
            Write-Host "   ✓ 已修复" -ForegroundColor Green
        }
    } else {
        Write-Host "   ⚠ 文件存在但不包含 DEEPSEEK_API_KEY，正在添加..." -ForegroundColor Yellow
        "DEEPSEEK_API_KEY=$apiKey" | Out-File -FilePath $envFile -Encoding utf8 -NoNewline
        Write-Host "   ✓ 已添加" -ForegroundColor Green
    }
} else {
    Write-Host "   ⚠ 文件不存在，正在创建..." -ForegroundColor Yellow
    "DEEPSEEK_API_KEY=$apiKey" | Out-File -FilePath $envFile -Encoding utf8 -NoNewline
    Write-Host "   ✓ 已创建" -ForegroundColor Green
}

Write-Host ""
Write-Host "2. 检查 next.config.js 配置..." -ForegroundColor Yellow
if (Test-Path "next.config.js") {
    $configContent = Get-Content "next.config.js" -Raw
    if ($configContent -match "allowedDevOrigins") {
        Write-Host "   ✓ 已配置 allowedDevOrigins" -ForegroundColor Green
        if ($configContent -match "192\.168\.1\.3") {
            Write-Host "   ✓ 包含 192.168.1.3" -ForegroundColor Green
        } else {
            Write-Host "   ⚠ 未包含 192.168.1.3" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠ 未配置 allowedDevOrigins" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ✗ next.config.js 文件不存在" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 修复完成 ===" -ForegroundColor Green
Write-Host ""
Write-Host "重要提示：" -ForegroundColor Yellow
Write-Host "1. 请停止当前开发服务器 (Ctrl+C)" -ForegroundColor White
Write-Host "2. 重新启动开发服务器: npm run dev" -ForegroundColor White
Write-Host "3. Next.js 只在启动时读取环境变量和配置" -ForegroundColor White
Write-Host ""
