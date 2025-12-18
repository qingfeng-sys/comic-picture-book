# 网络访问问题完整解决方案

## 问题描述

在 `localhost:3000` 可以正常访问，但无法通过局域网 IP 地址（如 `192.168.x.x:3000`）从其他设备访问。

## 解决方案

### 快速修复（推荐）

1. **运行一键修复脚本**（需要管理员权限）：
   ```powershell
   .\一键修复网络访问.bat
   ```

2. **运行诊断脚本**（检查问题）：
   ```powershell
   .\diagnose-network-access.ps1
   ```

3. **设置防火墙**（如果修复脚本无法运行）：
   ```powershell
   # 以管理员身份运行
   .\设置防火墙.bat
   ```

### 手动修复步骤

#### 步骤 1: 设置 Windows 防火墙

**方法 A: 使用批处理文件（推荐）**
```cmd
# 以管理员身份运行
.\设置防火墙.bat
```

**方法 B: 使用 PowerShell（需要管理员权限）**
```powershell
New-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" `
    -Direction Inbound `
    -LocalPort 3000 `
    -Protocol TCP `
    -Action Allow `
    -Profile Any
```

#### 步骤 2: 确认 package.json 配置

确保 `package.json` 中的启动脚本包含 `-H 0.0.0.0`：

```json
{
  "scripts": {
    "dev": "next dev -H 0.0.0.0",
    "start": "next start -H 0.0.0.0"
  }
}
```

#### 步骤 3: 确认 next.config.js 配置

`next.config.js` 应该包含 `experimental.allowedDevOrigins` 配置（可选，但推荐）：

```javascript
module.exports = {
  experimental: {
    allowedDevOrigins: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
  },
};
```

#### 步骤 4: 查找你的 IP 地址

**使用 PowerShell:**
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.IPAddress -notlike "127.*" -and 
    ($_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*") 
} | Select-Object -ExpandProperty IPAddress
```

**使用 ipconfig:**
```cmd
ipconfig
```
查找 "IPv4 地址"，通常是 `192.168.x.x` 格式。

#### 步骤 5: 启动服务器

```bash
npm run dev
```

服务器启动后，你会看到类似输出：
```
  ▲ Next.js 16.0.7
  - Local:        http://localhost:3000
  - Network:      http://0.0.0.0:3000
```

**重要：不要使用 `http://0.0.0.0:3000` 访问！** 这是监听地址，不是访问地址。

#### 步骤 6: 从其他设备访问

使用你的实际 IP 地址访问，例如：
- `http://192.168.1.199:3000`
- `http://192.168.1.3:3000`

## 常见问题排查

### 问题 1: 防火墙规则已设置但仍无法访问

**检查项：**
1. 确认防火墙规则已启用：
   ```powershell
   Get-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000"
   ```

2. 确认服务器正在运行并监听 0.0.0.0：
   ```powershell
   netstat -ano | findstr :3000
   ```
   应该看到 `0.0.0.0:3000` 或 `[::]:3000`

3. 完全停止服务器后重新启动：
   - 按 `Ctrl+C` 停止服务器
   - 等待几秒确保进程完全退出
   - 重新运行 `npm run dev`

### 问题 2: 可以访问页面但 API 调用失败

**原因：** API 路由的 CORS 配置问题

**解决方案：** API 路由已经配置了 CORS 头，如果仍有问题，检查：
1. 浏览器控制台是否有 CORS 错误
2. 网络请求是否到达服务器（检查服务器日志）
3. 确认 API 路由文件中的 `setCorsHeaders` 函数正常工作

### 问题 3: 端口被占用

**检查占用：**
```powershell
Get-NetTCPConnection -LocalPort 3000
```

**停止占用进程：**
```powershell
# 查找进程 ID
$connection = Get-NetTCPConnection -LocalPort 3000
$process = Get-Process -Id $connection.OwningProcess

# 停止进程
Stop-Process -Id $process.Id
```

### 问题 4: 客户端设备无法连接

**检查项：**
1. 确保客户端设备与服务器在同一网络（同一 WiFi 或局域网）
2. 尝试从服务器本机使用 IP 地址访问（不使用 localhost）
3. 检查路由器防火墙设置
4. 某些公司网络可能阻止设备间通信

## 验证步骤

1. **本地验证：**
   - 在服务器上访问 `http://localhost:3000` ✓
   - 在服务器上访问 `http://你的IP:3000` ✓

2. **网络验证：**
   - 从手机/其他电脑访问 `http://你的IP:3000` ✓
   - 测试故事脚本生成功能 ✓
   - 测试绘本生成功能 ✓

## 技术说明

### 为什么需要 `-H 0.0.0.0`？

- 默认情况下，Next.js 只监听 `localhost`（127.0.0.1），只能从本机访问
- `-H 0.0.0.0` 让服务器监听所有网络接口，允许从其他设备访问
- `0.0.0.0` 是监听地址，不是访问地址，必须使用实际 IP 访问

### CORS 配置

API 路由已经配置了 CORS 头，允许开发环境下的跨域请求：
- `Access-Control-Allow-Origin`: 允许的来源
- `Access-Control-Allow-Methods`: 允许的 HTTP 方法
- `Access-Control-Allow-Headers`: 允许的请求头

### Next.js 16 的 allowedDevOrigins

这是 Next.js 16 的实验性功能，用于控制开发环境下的访问源。即使不配置，只要服务器监听 `0.0.0.0` 且防火墙允许，也应该可以访问。

## 相关文件

- `setup-network.ps1` - 网络配置脚本（防火墙/提示 IP/验证监听）
- `diagnose-network-access.ps1` - 诊断脚本
- `设置防火墙.bat` - 防火墙设置脚本
- `next.config.js` - Next.js 配置文件
- `package.json` - 项目配置和启动脚本

## 如果问题仍然存在

1. 运行诊断脚本查看详细问题
2. 检查 Windows 事件查看器中的防火墙日志
3. 尝试使用其他端口（如 3001）测试
4. 检查是否有其他安全软件阻止连接
5. 确认网络配置（VPN、代理等）
