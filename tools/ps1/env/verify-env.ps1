# 验证环境变量配置
Write-Host "=== 验证环境变量配置 ===" -ForegroundColor Cyan
Write-Host ""

$envFile = ".env.local"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
Set-Location $projectRoot
$envFilePath = Join-Path $projectRoot $envFile

Write-Host "项目根目录: $projectRoot" -ForegroundColor Gray
Write-Host "环境变量文件路径: $envFilePath" -ForegroundColor Gray
Write-Host ""

# 检查文件是否存在
if (-not (Test-Path $envFilePath)) {
    Write-Host "✗ .env.local 文件不存在！" -ForegroundColor Red
  Write-Host "请先运行: powershell -ExecutionPolicy Bypass -File .\tools\ps1\env\setup-env.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ .env.local 文件存在" -ForegroundColor Green

# 读取文件内容
$content = Get-Content $envFilePath -Raw
Write-Host "`n文件内容:" -ForegroundColor Cyan
Write-Host $content -ForegroundColor White

# 检查配置（允许不同前缀的 key，因此不强制 sk-）
$hasDashScope = $content -match "DASHSCOPE_API_KEY\s*=\s*(?!your_)[^\r\n]+"
$hasQiniu = $content -match "QINIU_API_KEY\s*=\s*(?!your_)[^\r\n]+"

Write-Host "`n配置检查:" -ForegroundColor Cyan
if ($hasDashScope) {
  Write-Host "✓ DASHSCOPE_API_KEY 已配置" -ForegroundColor Green
} else {
  Write-Host "✗ DASHSCOPE_API_KEY 未配置或仍为占位符" -ForegroundColor Red
}

if ($hasQiniu) {
    Write-Host "✓ QINIU_API_KEY 已配置" -ForegroundColor Green
} else {
  Write-Host "✗ QINIU_API_KEY 未配置或仍为占位符" -ForegroundColor Red
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
Write-Host "1. 如需生成/更新 .env.local 模板:" -ForegroundColor White
Write-Host "   powershell -ExecutionPolicy Bypass -File .\tools\ps1\env\setup-env.ps1" -ForegroundColor Gray
Write-Host "2. 如果 .next 目录存在，删除它:" -ForegroundColor White
Write-Host "   Remove-Item -Recurse -Force .next" -ForegroundColor Gray
Write-Host "3. 完全停止开发服务器（Ctrl+C）" -ForegroundColor White
Write-Host "4. 重新启动: npm run dev（或运行 .\tools\ps1\dev\start-dev.ps1）" -ForegroundColor White
Write-Host ""
