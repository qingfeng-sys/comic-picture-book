@echo off

chcp 65001 >nul 2>&1



echo [DEPRECATED] This legacy starter is archived.

echo Use: tools\ps1\dev\quick-start.bat (or tools\ps1\network\one-click-network-fix.bat)

echo.



cd /d "%~dp0"

call "..\dev\quick-start.bat"



pause


