# 最终修复方案 - 七牛云API环境变量问题

## 问题分析

从错误堆栈可以看出，代码运行在 `.next\dev\server\chunks` 中，说明 Next.js 使用了缓存的编译结果。**环境变量只在服务器启动时读取，如果缓存存在，可能使用了旧的编译结果。**

## 完整修复步骤（必须按顺序执行）

### 步骤 1: 确保 .env.local 文件存在

在项目根目录 `d:\Projects\comic-picture-book` 创建 `.env.local` 文件，内容如下：

```
DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81
QINIU_API_KEY=sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe
```

**重要：**
- 不要有引号
- 不要有多余空格
- 等号两边不要有空格
- 每行一个变量

### 步骤 2: 完全停止开发服务器

**这是关键！必须完全停止，不能只是热重载！**

1. 在运行 `npm run dev` 的终端窗口按 `Ctrl + C`
2. **等待进程完全停止**（可能需要几秒）
3. **或者直接关闭终端窗口**（推荐，确保完全停止）

### 步骤 3: 清理所有缓存

在新的终端窗口中运行：

```powershell
cd d:\Projects\comic-picture-book

# 删除 .next 目录（最重要！）
Remove-Item -Recurse -Force .next

# 如果存在，也删除 node_modules/.cache
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache"
}
```

### 步骤 4: 验证 .env.local 文件

```powershell
# 检查文件是否存在
Test-Path .env.local

# 查看文件内容
Get-Content .env.local
```

应该看到：
```
DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81
QINIU_API_KEY=sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe
```

### 步骤 5: 重新启动开发服务器

```powershell
npm run dev
```

**关键验证点：**
启动后，查看终端输出，**必须**看到：
```
- Environments: .env.local
```

如果没有看到这一行，说明环境变量没有被读取！

### 步骤 6: 测试

1. 打开浏览器访问 http://localhost:3000
2. 尝试生成绘本图像
3. 查看服务器终端输出，应该看到：
   ```
   === API路由环境变量调试 ===
   process.env.QINIU_API_KEY: 已设置 (sk-164c03e...)
   === 七牛云API环境变量调试 ===
   process.env.QINIU_API_KEY: 已设置
   ```

## 如果仍然不工作

### 检查清单

- [ ] `.env.local` 文件在项目根目录（与 `package.json` 同级）
- [ ] 文件内容格式正确（没有引号、没有多余空格）
- [ ] **已完全停止开发服务器**（关闭终端窗口）
- [ ] **已删除 `.next` 缓存目录**
- [ ] **已重新启动开发服务器**（在新的终端窗口）
- [ ] **服务器启动时显示 `- Environments: .env.local`**

### 终极解决方案

如果以上所有步骤都完成，但仍然不工作，可以临时在代码中添加默认值（仅用于测试）：

在 `lib/qiniu.ts` 的 `submitQiniuImageTask` 函数中，修改：

```typescript
const apiKey = process.env.QINIU_API_KEY || 'sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe';
```

**注意：这只是临时测试，不要提交到 Git！**

## 常见错误

### 错误1: 只按了 Ctrl+C，但没有等待进程停止
**解决：** 关闭终端窗口，重新打开

### 错误2: 删除了 .next，但没有重启服务器
**解决：** 必须重启服务器才能重新编译

### 错误3: 文件存在，但格式不对（有引号或空格）
**解决：** 确保格式完全正确，参考步骤1

### 错误4: 服务器启动时没有显示 `- Environments: .env.local`
**解决：** 说明文件没有被读取，检查文件位置和格式
