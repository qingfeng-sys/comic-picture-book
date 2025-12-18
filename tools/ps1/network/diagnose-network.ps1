<#
=============================================================================
DEPRECATED (重复脚本已合并)

`tools/ps1/network/diagnose-network.ps1` 与根目录的 `diagnose-network-access.ps1`
功能重复。为避免维护两份逻辑，本脚本已改为“转发/包装器”，统一调用：

  .\diagnose-network-access.ps1

你可以继续运行本脚本，但实际执行的是主诊断脚本。
=============================================================================
#>

Write-Host "ℹ 已合并：本脚本将转发到根目录的 diagnose-network-access.ps1" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $PSCommandPath
$projectRoot = Resolve-Path (Join-Path $scriptDir "..\\..\\..")
$target = Join-Path $projectRoot "diagnose-network-access.ps1"

if (-not (Test-Path $target)) {
  Write-Host "✗ 未找到目标脚本: $target" -ForegroundColor Red
  Write-Host "请在项目根目录运行：.\\diagnose-network-access.ps1" -ForegroundColor Yellow
  exit 1
}

& $target










