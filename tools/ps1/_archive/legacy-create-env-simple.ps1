# =============================================================================
# DEPRECATED / ARCHIVED (历史脚本 - 不建议继续使用)
#
# 该脚本会用过时的环境变量模板写入 .env.local，并使用 ASCII 编码。
# 已归档到 tools/ps1/_archive/，仅保留供参考。
#
# 推荐替代：
# - 生成/更新当前项目 env 模板：.\setup-env.ps1
# - 校验 env 配置：            .\verify-env.ps1
# =============================================================================

Write-Host "⚠ [已弃用] legacy-create-env-simple.ps1 已归档（模板过时/编码不推荐），仅供参考。" -ForegroundColor Yellow
Write-Host "   请改用: .\setup-env.ps1（生成模板） + .\verify-env.ps1（校验）" -ForegroundColor Yellow
Write-Host ""

# 简单创建 .env.local 文件
$file = ".env.local"
$content = @"
DEEPSEEK_API_KEY=your_deepseek_api_key_here
QINIU_API_KEY=your_qiniu_api_key_here
"@

$content | Out-File -FilePath $file -Encoding ASCII -NoNewline
Write-Host "文件已创建: $file"
Get-Content $file
