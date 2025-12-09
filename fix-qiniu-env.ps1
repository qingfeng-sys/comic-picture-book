# 修复七牛云API环境变量配置
Write-Host "正在配置七牛云API环境变量..." -ForegroundColor Cyan

$envFile = ".env.local"
$qiniuKey = "sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe"
$deepseekKey = "sk-7184f5ee339047b98aff5b1d7d1e2b81"

# 读取现有内容
$content = ""
if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    Write-Host "✓ 找到现有的 .env.local 文件" -ForegroundColor Green
} else {
    Write-Host "⚠ .env.local 文件不存在，正在创建..." -ForegroundColor Yellow
}

# 检查并更新内容
$lines = @()

# 处理现有内容
if ($content) {
    $existingLines = $content -split "`r?`n"
    $hasDeepSeek = $false
    $hasQiniu = $false
    
    foreach ($line in $existingLines) {
        if ($line -match "^#.*DeepSeek|^DEEPSEEK_API_KEY") {
            $hasDeepSeek = $true
            if ($line -match "^DEEPSEEK_API_KEY") {
                $lines += "DEEPSEEK_API_KEY=$deepseekKey"
            } else {
                $lines += $line
            }
        } elseif ($line -match "^#.*七牛云|^QINIU_API_KEY") {
            $hasQiniu = $true
            if ($line -match "^QINIU_API_KEY") {
                $lines += "QINIU_API_KEY=$qiniuKey"
            } else {
                $lines += $line
            }
        } elseif ($line.Trim() -ne "") {
            $lines += $line
        }
    }
    
    # 添加缺失的配置
    if (-not $hasDeepSeek) {
        $lines = @("# DeepSeek API配置（用于生成故事脚本）", "DEEPSEEK_API_KEY=$deepseekKey", "") + $lines
    }
    if (-not $hasQiniu) {
        if ($lines.Count -gt 0 -and $lines[-1] -ne "") {
            $lines += ""
        }
        $lines += "# 七牛云API配置（用于生成绘本图像）"
        $lines += "QINIU_API_KEY=$qiniuKey"
    }
} else {
    # 创建新文件
    $lines = @(
        "# DeepSeek API配置（用于生成故事脚本）",
        "DEEPSEEK_API_KEY=$deepseekKey",
        "",
        "# 七牛云API配置（用于生成绘本图像）",
        "QINIU_API_KEY=$qiniuKey"
    )
}

# 写入文件
$lines -join "`n" | Out-File -FilePath $envFile -Encoding utf8 -NoNewline

Write-Host "`n✓ 环境变量文件已更新！" -ForegroundColor Green
Write-Host "`n文件内容:" -ForegroundColor Cyan
Get-Content $envFile
Write-Host "`n重要提示：" -ForegroundColor Yellow
Write-Host "1. 请停止当前开发服务器（如果正在运行，按 Ctrl+C）" -ForegroundColor White
Write-Host "2. 重新启动开发服务器: npm run dev" -ForegroundColor White
Write-Host "3. Next.js 只在启动时读取环境变量，修改后必须重启！" -ForegroundColor White
