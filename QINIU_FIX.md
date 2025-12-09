# 七牛云API环境变量问题修复指南

## 问题症状
错误信息：`QINIU_API_KEY环境变量未设置，请在.env.local文件中配置API密钥`

## 完整解决步骤

### 步骤 1: 确保 .env.local 文件存在且格式正确

在项目根目录（`d:\Projects\comic-picture-book`）创建或编辑 `.env.local` 文件：

```env
DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81
QINIU_API_KEY=sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe
```

**重要提示：**
- 不要有引号
- 不要有多余的空格
- 等号两边不要有空格
- 每行一个变量

### 步骤 2: 使用修复脚本

运行以下命令：

```powershell
cd d:\Projects\comic-picture-book
powershell -ExecutionPolicy Bypass -File .\create-env-simple.ps1
```

### 步骤 3: 清理 Next.js 缓存

```powershell
Remove-Item -Recurse -Force .next
```

### 步骤 4: 完全重启开发服务器

**这是最关键的一步！**

1. **完全停止服务器**
   - 在运行 `npm run dev` 的终端窗口
   - 按 `Ctrl + C` 停止
   - 确认进程已完全停止（可以关闭终端窗口）

2. **重新启动服务器**
   ```powershell
   npm run dev
   ```

3. **验证环境变量已加载**
   - 查看终端输出，应该显示：`- Environments: .env.local`
   - 如果没有显示，说明文件没有被读取

### 步骤 5: 测试

1. 打开浏览器访问 http://localhost:3000
2. 尝试生成绘本图像
3. 查看服务器终端输出，应该会显示调试信息：
   ```
   === 七牛云API环境变量调试 ===
   process.env.QINIU_API_KEY: 已设置
   ```

## 如果仍然不工作

### 检查清单

- [ ] `.env.local` 文件在项目根目录（与 `package.json` 同级）
- [ ] 文件内容格式正确（没有引号、没有多余空格）
- [ ] 已删除 `.next` 缓存目录
- [ ] 已完全停止开发服务器（不是热重载）
- [ ] 已重新启动开发服务器
- [ ] 服务器启动时显示 `- Environments: .env.local`

### 手动验证文件

```powershell
# 检查文件是否存在
Test-Path .env.local

# 查看文件内容
Get-Content .env.local

# 检查文件编码（应该是 UTF-8）
[System.IO.File]::ReadAllText("$PWD\.env.local", [System.Text.Encoding]::UTF8)
```

### 临时调试方案

如果以上都不工作，可以在代码中临时添加调试信息（已在代码中添加）：

查看 `lib/qiniu.ts` 和 `app/api/comic/generate/route.ts` 中的调试输出。

## 常见问题

### Q: 文件存在但服务器还是读不到？

A: 
1. 确认文件在项目根目录
2. 清理 `.next` 缓存
3. **完全重启服务器**（关闭终端窗口，重新打开，然后运行 `npm run dev`）

### Q: 修改 .env.local 后需要重启吗？

A: **是的！** Next.js 只在启动时读取环境变量。修改后必须完全重启服务器。

### Q: 如何确认环境变量已加载？

A: 
1. 查看服务器启动时的输出，应该显示：`- Environments: .env.local`
2. 查看代码中的调试输出（已在代码中添加）
3. 如果看到 "已设置" 但API调用仍然失败，可能是API密钥本身的问题

## 联系支持

如果完成以上所有步骤仍然不工作，请提供：
1. `.env.local` 文件内容（隐藏API密钥的后半部分）
2. 服务器启动时的完整输出
3. 浏览器控制台的错误信息
4. 服务器终端的错误信息
