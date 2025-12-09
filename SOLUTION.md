# 环境变量问题完整解决方案

## 问题诊断

如果一直遇到 "DEEPSEEK_API_KEY环境变量未设置" 错误，请按以下步骤操作：

## 步骤 1: 确认文件存在

在项目根目录（与 `package.json` 同级）确认 `.env.local` 文件存在：

```powershell
# 检查文件
Test-Path .env.local

# 查看文件内容
Get-Content .env.local
```

文件内容应该是：
```
DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81
```

## 步骤 2: 如果文件不存在，创建它

```powershell
# 方法1: 使用 PowerShell
"DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81" | Out-File -FilePath .env.local -Encoding utf8 -NoNewline

# 方法2: 使用 echo（Windows CMD）
echo DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81 > .env.local

# 方法3: 使用脚本
.\setup-env.ps1
```

## 步骤 3: 清理 Next.js 缓存（重要！）

Next.js 可能缓存了旧的环境变量状态。清理缓存：

```powershell
# 删除 .next 目录
Remove-Item -Recurse -Force .next

# 或者手动删除 .next 文件夹
```

## 步骤 4: 完全重启开发服务器

**这是最关键的一步！**

1. **完全停止服务器**
   - 在运行 `npm run dev` 的终端窗口
   - 按 `Ctrl + C` 停止
   - 确认进程已完全停止

2. **重新启动服务器**
   ```powershell
   npm run dev
   ```

3. **验证环境变量已加载**
   - 查看终端输出，应该显示：`- Environments: .env.local`
   - 如果没有显示，说明文件没有被读取

## 步骤 5: 测试

1. 打开浏览器访问 http://localhost:3000
2. 尝试生成脚本
3. 查看服务器终端输出，应该会显示调试信息：
   ```
   === 环境变量调试信息 ===
   process.env.DEEPSEEK_API_KEY: 已设置
   ...
   ```

## 如果仍然不工作

### 方法 A: 检查文件位置

确保 `.env.local` 文件在项目根目录：
```
d:\Projects\comic-picture-book\.env.local  ✓ 正确
d:\Projects\comic-picture-book\app\.env.local  ✗ 错误
```

### 方法 B: 检查文件格式

文件应该是纯文本，UTF-8 编码，内容：
```
DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81
```

**不要有：**
- 多余的空格
- 引号
- 注释符号（除非是单独一行）

### 方法 C: 使用环境变量前缀（Next.js 要求）

Next.js 要求客户端环境变量必须以 `NEXT_PUBLIC_` 开头，但服务器端变量不需要。

对于服务器端 API 路由，`DEEPSEEK_API_KEY` 应该可以直接使用。

### 方法 D: 临时硬编码测试（仅用于诊断）

如果以上都不工作，可以临时在代码中硬编码测试：

```typescript
// lib/deepseek.ts
const apiKey = process.env.DEEPSEEK_API_KEY || 'sk-7184f5ee339047b98aff5b1d7d1e2b81';
```

**注意：这只是临时测试，不要提交到 Git！**

## 常见问题

### Q: 文件存在但服务器还是读不到？

A: 
1. 确认文件在项目根目录
2. 清理 `.next` 缓存
3. **完全重启服务器**（不是热重载）

### Q: 修改 .env.local 后需要重启吗？

A: **是的！** Next.js 只在启动时读取环境变量。修改后必须重启服务器。

### Q: .env.local 被 Git 忽略会影响读取吗？

A: **不会！** Git 忽略不影响文件系统，Next.js 可以正常读取。

### Q: 如何确认环境变量已加载？

A: 查看服务器启动时的输出，应该显示：
```
- Environments: .env.local
```

或者在代码中添加调试信息（已添加）。

## 最终检查清单

- [ ] `.env.local` 文件存在于项目根目录
- [ ] 文件内容格式正确（`DEEPSEEK_API_KEY=sk-...`）
- [ ] 已清理 `.next` 缓存
- [ ] 已完全停止开发服务器
- [ ] 已重新启动开发服务器
- [ ] 服务器启动时显示 `- Environments: .env.local`
- [ ] 测试生成脚本功能

如果完成以上所有步骤仍然不工作，请检查：
1. Next.js 版本是否支持 `.env.local`
2. 是否有其他配置文件覆盖了环境变量
3. 服务器终端是否有其他错误信息
