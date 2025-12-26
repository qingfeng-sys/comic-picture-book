@echo off

chcp 65001 >nul 2>&1

cd /d "%~dp0"

call "tools\ps1\network\diagnose-network.bat"









