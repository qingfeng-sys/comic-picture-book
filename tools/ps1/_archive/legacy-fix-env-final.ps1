# =============================================================================
# DEPRECATED / ARCHIVED (历史脚本 - 不建议继续使用)
#
# 该脚本会覆盖写入 .env.local（旧模板），并删除 .next / node_modules\.cache。
# 已归档到 tools/ps1/_archive/，仅保留供参考。
#
# 推荐替代：
# - 生成/更新当前项目 env 模板：.\setup-env.ps1
# - 校验 env 配置：            .\verify-env.ps1
#
# 注意：清理缓存属于破坏性操作，运行前请确认没有需要保留的构建缓存。
# =============================================================================

Write-Host "⚠ [已弃用] legacy-fix-env-final.ps1 已归档（会覆盖 env/删缓存），仅供参考。" -ForegroundColor Yellow
Write-Host "   请优先改用: .\setup-env.ps1 + .\verify-env.ps1（必要时再手动删除 .next）" -ForegroundColor Yellow
Write-Host ""

# 最终修复环境变量问题
Write-Host "=== 最终修复环境变量问题 ===" -ForegroundColor Cyan
Write-Host ""

$projectRoot = (Get-Location).Path
$envFile = ".env.local"
$envFilePath = Join-Path $projectRoot $envFile

Write-Host "项目根目录: $projectRoot" -ForegroundColor Gray
Write-Host "环境变量文件路径: $envFilePath" -ForegroundColor Gray
Write-Host ""

# 步骤1: 创建/更新 .env.local 文件
Write-Host "步骤1: 创建/更新 .env.local 文件..." -ForegroundColor Yellow

$content = "DEEPSEEK_API_KEY=your_deepseek_api_key_here`nQINIU_API_KEY=your_qiniu_api_key_here"

try {
    # 使用 UTF8 无 BOM 编码
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($envFilePath, $content, $utf8NoBom)
    Write-Host "✓ 文件已创建/更新" -ForegroundColor Green
} catch {
    Write-Host "✗ 创建文件失败: $_" -ForegroundColor Red
    exit 1
}

# 步骤2: 验证文件
Write-Host "`n步骤2: 验证文件..." -ForegroundColor Yellow
if (Test-Path $envFilePath) {
    Write-Host "✓ 文件存在" -ForegroundColor Green
    $fileContent = Get-Content $envFilePath -Raw
    Write-Host "`n文件内容:" -ForegroundColor Cyan
    Write-Host $fileContent -ForegroundColor White
    
    if ($fileContent -match "QINIU_API_KEY\s*=\s*sk-") {
        Write-Host "`n✓ QINIU_API_KEY 配置正确" -ForegroundColor Green
    } else {
        Write-Host "`n✗ QINIU_API_KEY 配置不正确" -ForegroundColor Red
    }
} else {
    Write-Host "✗ 文件不存在" -ForegroundColor Red
    exit 1
}

# 步骤3: 清理 Next.js 缓存
Write-Host "`n步骤3: 清理 Next.js 缓存..." -ForegroundColor Yellow
$nextDir = Join-Path $projectRoot ".next"
if (Test-Path $nextDir) {
    try {
        Remove-Item -Recurse -Force $nextDir
        Write-Host "✓ .next 缓存已删除" -ForegroundColor Green
    } catch {
        Write-Host "⚠ 无法删除 .next 目录: $_" -ForegroundColor Yellow
        Write-Host "  请手动删除: Remove-Item -Recurse -Force .next" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ .next 目录不存在" -ForegroundColor Green
}

# 步骤4: 清理 node_modules/.cache（如果存在）
$cacheDir = Join-Path $projectRoot "node_modules\.cache"
if (Test-Path $cacheDir) {
    try {
        Remove-Item -Recurse -Force $cacheDir
        Write-Host "✓ node_modules/.cache 已删除" -ForegroundColor Green
    } catch {
        Write-Host "⚠ 无法删除缓存目录" -ForegroundColor Yellow
    }
}

Write-Host "`n=== 修复完成 ===" -ForegroundColor Green
Write-Host "`n重要提示：" -ForegroundColor Yellow
Write-Host "1. 请完全停止开发服务器（按 Ctrl+C，或关闭终端窗口）" -ForegroundColor White
Write-Host "2. 重新打开终端窗口" -ForegroundColor White
Write-Host "3. 运行: npm run dev" -ForegroundColor White
Write-Host "4. 启动后查看终端，应该显示: - Environments: .env.local" -ForegroundColor White
Write-Host ""
