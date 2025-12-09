# 创建和验证 .env.local 文件
Write-Host "=== 创建 .env.local 文件 ===" -ForegroundColor Cyan
Write-Host ""

$envFile = ".env.local"
$apiKey = "sk-7184f5ee339047b98aff5b1d7d1e2b81"
$content = "DEEPSEEK_API_KEY=$apiKey"

# 获取项目根目录的绝对路径
$projectRoot = (Get-Location).Path
$envFilePath = Join-Path $projectRoot $envFile

Write-Host "项目根目录: $projectRoot" -ForegroundColor Gray
Write-Host "环境变量文件路径: $envFilePath" -ForegroundColor Gray
Write-Host ""

# 创建文件
try {
    # 使用 UTF8 编码，无 BOM
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
    Write-Host "文件内容: $fileContent" -ForegroundColor Gray
    
    if ($fileContent -match "DEEPSEEK_API_KEY\s*=\s*sk-") {
        Write-Host "✓ 内容格式正确" -ForegroundColor Green
    } else {
        Write-Host "⚠ 内容格式可能有问题" -ForegroundColor Yellow
    }
    
    $fileInfo = Get-Item $envFilePath
    Write-Host "文件大小: $($fileInfo.Length) 字节" -ForegroundColor Gray
    Write-Host "最后修改: $($fileInfo.LastWriteTime)" -ForegroundColor Gray
} else {
    Write-Host "✗ 文件不存在" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== 重要提示 ===" -ForegroundColor Yellow
Write-Host "1. Next.js 只在启动时读取环境变量" -ForegroundColor White
Write-Host "2. 如果开发服务器正在运行，必须重启才能生效" -ForegroundColor White
Write-Host "3. 停止服务器: 在终端按 Ctrl+C" -ForegroundColor White
Write-Host "4. 重新启动: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "注意: .env.local 文件被 Git 忽略是正常的（包含敏感信息）" -ForegroundColor Gray
Write-Host "这不会影响 Next.js 读取环境变量" -ForegroundColor Gray
Write-Host ""
