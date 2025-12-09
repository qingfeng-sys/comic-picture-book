# 快速修复：0.0.0.0 无法访问的问题

## 问题
Next.js 显示 `Network: http://0.0.0.0:3000`，但点击后出现 HTTP 502 错误。

## 原因
`0.0.0.0` **不是可访问的地址**！它只是表示服务器监听所有网络接口。你必须使用**实际的 IP 地址**访问。

## 解决方案

### 1. 查找你的实际 IP 地址

运行以下命令：
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" }
```

或者使用：
```powershell
ipconfig
```
查找 "IPv4 地址"（通常是 `192.168.x.x` 格式）

### 2. 使用实际 IP 地址访问

**不要访问：** `http://0.0.0.0:3000` ❌

**应该访问：**
- 本机：`http://localhost:3000` ✅
- 网络：`http://192.168.1.199:3000` ✅（使用你找到的实际 IP）

### 3. 如果网络访问仍然失败

#### 检查防火墙
以管理员身份运行：
```powershell
New-NetFirewallRule -DisplayName "Next.js Dev Server Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Any
```

#### 验证服务器绑定
```powershell
netstat -ano | findstr :3000
```
应该看到 `0.0.0.0:3000`（这表示正确绑定）

## 快速启动脚本

使用提供的脚本，会自动显示你的 IP 地址：
```powershell
.\start-dev-with-ip.ps1
```

## 总结

- ✅ 服务器配置正确（显示 0.0.0.0 是正常的）
- ✅ 使用实际 IP 地址访问（如 `192.168.1.199:3000`）
- ✅ 确保防火墙允许端口 3000
- ❌ 不要访问 `0.0.0.0:3000`


