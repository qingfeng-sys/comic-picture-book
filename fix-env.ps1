# 修复环境变量配置脚本
Write-Host "正在检查和修复 .env.local 文件..." -ForegroundColor Cyan

$envFile = ".env.local"
$deepseekKey = "sk-7184f5ee339047b98aff5b1d7d1e2b81"
$qiniuKey = "sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe"

# 读取现有内容（如果文件存在）
$existingContent = ""
if (Test-Path $envFile) {
    Write-Host "✓ .env.local 文件存在" -ForegroundColor Green
    $existingContent = Get-Content $envFile -Raw
} else {
    Write-Host "⚠ .env.local 文件不存在，正在创建..." -ForegroundColor Yellow
}

# 构建新的环境变量内容
$newContent = @()

# 检查并添加 DEEPSEEK_API_KEY
if ($existingContent -match "DEEPSEEK_API_KEY\s*=") {
    Write-Host "✓ 文件中已包含 DEEPSEEK_API_KEY" -ForegroundColor Green
    # 保留原有配置或更新
    if ($existingContent -match "DEEPSEEK_API_KEY\s*=\s*sk-7184f5ee339047b98aff5b1d7d1e2b81") {
        $newContent += "# DeepSeek API配置（用于生成故事脚本）"
        $newContent += "DEEPSEEK_API_KEY=$deepseekKey"
    } else {
        # 保留用户自定义的密钥
        $lines = $existingContent -split "`n"
        foreach ($line in $lines) {
            if ($line -match "DEEPSEEK_API_KEY") {
                $newContent += $line.Trim()
                break
            }
        }
    }
} else {
    Write-Host "⚠ 文件中缺少 DEEPSEEK_API_KEY，正在添加..." -ForegroundColor Yellow
    $newContent += "# DeepSeek API配置（用于生成故事脚本）"
    $newContent += "DEEPSEEK_API_KEY=$deepseekKey"
}

# 添加空行
$newContent += ""

# 检查并添加 QINIU_API_KEY
if ($existingContent -match "QINIU_API_KEY\s*=") {
    Write-Host "✓ 文件中已包含 QINIU_API_KEY" -ForegroundColor Green
    # 保留原有配置或更新
    if ($existingContent -match "QINIU_API_KEY\s*=\s*sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe") {
        $newContent += "# 七牛云API配置（用于生成绘本图像）"
        $newContent += "QINIU_API_KEY=$qiniuKey"
    } else {
        # 保留用户自定义的密钥
        $lines = $existingContent -split "`n"
        foreach ($line in $lines) {
            if ($line -match "QINIU_API_KEY") {
                $newContent += $line.Trim()
                break
            }
        }
    }
} else {
    Write-Host "⚠ 文件中缺少 QINIU_API_KEY，正在添加..." -ForegroundColor Yellow
    $newContent += "# 七牛云API配置（用于生成绘本图像）"
    $newContent += "QINIU_API_KEY=$qiniuKey"
}

# 写入文件
$newContent -join "`n" | Out-File -FilePath $envFile -Encoding utf8 -NoNewline

Write-Host "`n✓ 环境变量文件已更新！" -ForegroundColor Green
Write-Host "`n文件内容:" -ForegroundColor Cyan
Get-Content $envFile
Write-Host "`n重要提示：" -ForegroundColor Yellow
Write-Host "1. 请确保开发服务器已停止（如果正在运行，按 Ctrl+C）" -ForegroundColor White
Write-Host "2. 重新启动开发服务器: npm run dev" -ForegroundColor White
Write-Host "3. Next.js 只在启动时读取环境变量，修改后必须重启！" -ForegroundColor White
