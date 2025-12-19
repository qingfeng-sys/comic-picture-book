@echo off
chcp 65001 >nul
echo ========================================
echo  启动 Next.js 开发服务器（网络访问）
echo ========================================
echo.

echo 检查配置...
if not exist "package.json" (
    echo 错误: 未找到 package.json
    pause
    exit /b 1
)

echo.
echo 提示: 如果无法从网络访问，请检查：
echo 1. Windows 防火墙是否允许端口 3000
echo 2. 设备是否在同一局域网
echo.
echo 启动服务器...
echo.

call npm run dev

pause









