# 创建.env.local文件的PowerShell脚本

$envContent = @"
# DeepSeek API配置
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# OpenAI API配置（用于图像生成，可选）
# OPENAI_API_KEY=your_openai_api_key_here
"@

$envFile = ".env.local"

if (Test-Path $envFile) {
    Write-Host "警告: .env.local 文件已存在" -ForegroundColor Yellow
    $overwrite = Read-Host "是否要覆盖? (y/n)"
    if ($overwrite -ne "y") {
        Write-Host "操作已取消" -ForegroundColor Red
        exit
    }
}

$envContent | Out-File -FilePath $envFile -Encoding utf8 -NoNewline
Write-Host "✓ .env.local 文件已创建！" -ForegroundColor Green
Write-Host ""
Write-Host "文件内容:" -ForegroundColor Cyan
Get-Content $envFile
Write-Host ""
Write-Host "提示: 请重启开发服务器以使环境变量生效" -ForegroundColor Yellow

