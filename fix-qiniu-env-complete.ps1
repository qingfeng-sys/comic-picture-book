# 完整修复七牛云API环境变量配置
Write-Host "=== 修复七牛云API环境变量配置 ===" -ForegroundColor Cyan
Write-Host ""

$envFile = ".env.local"
$qiniuKey = "sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe"
$deepseekKey = "sk-7184f5ee339047b98aff5b1d7d1e2b81"

# 获取项目根目录
$projectRoot = (Get-Location).Path
$envFilePath = Join-Path $projectRoot $envFile

Write-Host "项目根目录: $projectRoot" -ForegroundColor Gray
Write-Host "环境变量文件路径: $envFilePath" -ForegroundColor Gray
Write-Host ""

# 创建正确的内容
$content = @"
# DeepSeek API配置（用于生成故事脚本）
DEEPSEEK_API_KEY=$deepseekKey

# 七牛云API配置（用于生成绘本图像）
QINIU_API_KEY=$qiniuKey
"@

# 使用 UTF8 无 BOM 编码写入文件
try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($envFilePath, $content, $utf8NoBom)
    Write-Host "✓ .env.local 文件已创建/更新" -ForegroundColor Green
} catch {
    Write-Host "✗ 创建文件失败: $_" -ForegroundColor Red
    exit 1
}

# 验证文件
if (Test-Path $envFilePath) {
    Write-Host "✓ 文件存在" -ForegroundColor Green
    
    $fileContent = Get-Content $envFilePath -Raw
    Write-Host "`n文件内容:" -ForegroundColor Cyan
    Write-Host $fileContent -ForegroundColor White
    
    # 检查内容
    $hasDeepSeek = $fileContent -match "DEEPSEEK_API_KEY\s*=\s*sk-"
    $hasQiniu = $fileContent -match "QINIU_API_KEY\s*=\s*sk-"
    
    if ($hasDeepSeek) {
        Write-Host "`n✓ DEEPSEEK_API_KEY 配置正确" -ForegroundColor Green
    } else {
        Write-Host "`n✗ DEEPSEEK_API_KEY 配置缺失或格式错误" -ForegroundColor Red
    }
    
    if ($hasQiniu) {
        Write-Host "✓ QINIU_API_KEY 配置正确" -ForegroundColor Green
    } else {
        Write-Host "✗ QINIU_API_KEY 配置缺失或格式错误" -ForegroundColor Red
    }
    
    $fileInfo = Get-Item $envFilePath
    Write-Host "`n文件信息:" -ForegroundColor Gray
    Write-Host "  大小: $($fileInfo.Length) 字节" -ForegroundColor Gray
    Write-Host "  最后修改: $($fileInfo.LastWriteTime)" -ForegroundColor Gray
} else {
    Write-Host "✗ 文件不存在" -ForegroundColor Red
    exit 1
}

# 清理 Next.js 缓存
Write-Host "`n=== 清理 Next.js 缓存 ===" -ForegroundColor Cyan
$nextDir = Join-Path $projectRoot ".next"
if (Test-Path $nextDir) {
    try {
        Remove-Item -Recurse -Force $nextDir
        Write-Host "✓ .next 缓存目录已删除" -ForegroundColor Green
    } catch {
        Write-Host "⚠ 无法删除 .next 目录: $_" -ForegroundColor Yellow
        Write-Host "  请手动删除 .next 文件夹" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ .next 目录不存在（无需清理）" -ForegroundColor Green
}

Write-Host "`n=== 重要提示 ===" -ForegroundColor Yellow
Write-Host "1. 请完全停止开发服务器（在终端按 Ctrl+C）" -ForegroundColor White
Write-Host "2. 重新启动开发服务器: npm run dev" -ForegroundColor White
Write-Host "3. Next.js 只在启动时读取环境变量，修改后必须重启！" -ForegroundColor White
Write-Host "4. 启动后查看终端输出，应该显示: - Environments: .env.local" -ForegroundColor White
Write-Host ""
