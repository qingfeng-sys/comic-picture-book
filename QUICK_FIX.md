# 快速修复环境变量问题

## 问题说明

你遇到的错误是因为命令不完整。正确的命令应该包含 `powershell` 前缀。

## 方法一：使用完整的PowerShell命令（推荐）

在PowerShell终端中运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\create-env-simple.ps1
```

**注意**：命令开头必须有 `powershell`

## 方法二：直接在PowerShell中运行脚本（更简单）

如果你已经在PowerShell中，可以直接运行：

```powershell
.\create-env-simple.ps1
```

如果遇到执行策略错误，先运行：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\create-env-simple.ps1
```

## 方法三：手动创建文件（最简单）

直接在项目根目录创建 `.env.local` 文件，内容如下：

```
DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81
QINIU_API_KEY=sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe
```

**步骤：**
1. 在项目根目录（`d:\Projects\comic-picture-book`）创建文件 `.env.local`
2. 复制上面的内容到文件中
3. 保存文件

## 方法四：使用命令行（CMD）

如果你在CMD中，可以使用：

```cmd
cd d:\Projects\comic-picture-book
echo DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81 > .env.local
echo QINIU_API_KEY=sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe >> .env.local
```

## 完成后的步骤

1. **验证文件已创建**：
   ```powershell
   Get-Content .env.local
   ```

2. **清理缓存**：
   ```powershell
   Remove-Item -Recurse -Force .next
   ```

3. **重启开发服务器**：
   - 停止当前服务器（Ctrl+C）
   - 重新启动：`npm run dev`

## 验证

启动服务器后，查看终端输出，应该显示：
```
- Environments: .env.local
```

如果看到这个，说明环境变量已成功加载！
