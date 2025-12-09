# 验证环境变量配置
Write-Host "=== 验证环境变量配置 ===" -ForegroundColor Cyan
Write-Host ""

$envFile = ".env.local"
$projectRoot = (Get-Location).Path
$envFilePath = Join-Path $projectRoot $envFile

Write-Host "项目根目录: $projectRoot" -ForegroundColor Gray
Write-Host "环境变量文件路径: $envFilePath" -ForegroundColor Gray
Write-Host ""

# 检查文件是否存在
if (-not (Test-Path $envFilePath)) {
    Write-Host "✗ .env.local 文件不存在！" -ForegroundColor Red
    Write-Host "请运行: powershell -ExecutionPolicy Bypass -File .\fix-qiniu-env-complete.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ .env.local 文件存在" -ForegroundColor Green

# 读取文件内容
$content = Get-Content $envFilePath -Raw
Write-Host "`n文件内容:" -ForegroundColor Cyan
Write-Host $content -ForegroundColor White

# 检查配置
$hasDeepSeek = $content -match "DEEPSEEK_API_KEY\s*=\s*sk-"
$hasQiniu = $content -match "QINIU_API_KEY\s*=\s*sk-"

Write-Host "`n配置检查:" -ForegroundColor Cyan
if ($hasDeepSeek) {
    Write-Host "✓ DEEPSEEK_API_KEY 已配置" -ForegroundColor Green
} else {
    Write-Host "✗ DEEPSEEK_API_KEY 未配置或格式错误" -ForegroundColor Red
}

if ($hasQiniu) {
    Write-Host "✓ QINIU_API_KEY 已配置" -ForegroundColor Green
} else {
    Write-Host "✗ QINIU_API_KEY 未配置或格式错误" -ForegroundColor Red
}

# 检查 .next 目录
$nextDir = Join-Path $projectRoot ".next"
if (Test-Path $nextDir) {
    Write-Host "`n⚠ .next 缓存目录存在" -ForegroundColor Yellow
    Write-Host "  建议删除缓存后重启服务器" -ForegroundColor Yellow
    Write-Host "  删除命令: Remove-Item -Recurse -Force .next" -ForegroundColor Gray
} else {
    Write-Host "`n✓ .next 缓存目录不存在" -ForegroundColor Green
}

Write-Host "`n=== 下一步操作 ===" -ForegroundColor Yellow
Write-Host "1. 如果配置有误，运行修复脚本:" -ForegroundColor White
Write-Host "   powershell -ExecutionPolicy Bypass -File .\fix-qiniu-env-complete.ps1" -ForegroundColor Gray
Write-Host "2. 如果 .next 目录存在，删除它:" -ForegroundColor White
Write-Host "   Remove-Item -Recurse -Force .next" -ForegroundColor Gray
Write-Host "3. 完全停止开发服务器（Ctrl+C）" -ForegroundColor White
Write-Host "4. 重新启动: npm run dev" -ForegroundColor White
Write-Host ""
