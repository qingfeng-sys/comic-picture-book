# 简单创建 .env.local 文件
$file = ".env.local"
$content = @"
DEEPSEEK_API_KEY=your_deepseek_api_key_here
QINIU_API_KEY=your_qiniu_api_key_here
"@

$content | Out-File -FilePath $file -Encoding ASCII -NoNewline
Write-Host "文件已创建: $file"
Get-Content $file
