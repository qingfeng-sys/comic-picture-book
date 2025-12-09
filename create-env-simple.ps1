# 简单创建 .env.local 文件
$file = ".env.local"
$content = @"
DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81
QINIU_API_KEY=sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe
"@

$content | Out-File -FilePath $file -Encoding ASCII -NoNewline
Write-Host "文件已创建: $file"
Get-Content $file
