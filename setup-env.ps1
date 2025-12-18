# 创建/更新 .env.local（项目必需环境变量模板）

$envFile = ".env.local"

$envContent = @"
# DashScope（必需）- 用于故事大纲/剧本/分镜生成
DASHSCOPE_API_KEY=your_dashscope_api_key_here

# 七牛云（必需）- 用于图像生成
QINIU_API_KEY=your_qiniu_api_key_here

# 可选：启用调用前密钥校验（会增加一次额外调用，可能产生费用）
# ENABLE_API_KEY_VERIFICATION=true

# （可选）DashScope 文本生成超时（毫秒，模型较大/高峰期可适当加大）
# DASHSCOPE_SCRIPT_TIMEOUT_MS=90000
# DASHSCOPE_STORYBOARD_TIMEOUT_MS=120000
"@

if (Test-Path $envFile) {
    Write-Host "警告: .env.local 文件已存在" -ForegroundColor Yellow
    $overwrite = Read-Host "是否要覆盖? (y/n)"
    if ($overwrite -ne "y") {
        Write-Host "操作已取消" -ForegroundColor Red
        exit
    }
}

# 使用 UTF-8 无 BOM 写入，避免某些环境变量解析问题
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $envFile), $envContent, $utf8NoBom)

Write-Host "✓ .env.local 文件已创建/更新！" -ForegroundColor Green
Write-Host ""
Write-Host "文件内容:" -ForegroundColor Cyan
Get-Content $envFile
Write-Host ""
Write-Host "提示: 修改 .env.local 后必须重启开发服务器才能生效" -ForegroundColor Yellow
