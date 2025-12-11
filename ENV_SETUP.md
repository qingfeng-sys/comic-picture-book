# 环境变量配置说明

## 快速设置（推荐）

### 方法一：使用自动配置脚本

**Windows (PowerShell):**
```powershell
.\setup-env.ps1
```

**Linux/Mac (Bash):**
```bash
chmod +x setup-env.sh
./setup-env.sh
```

脚本会自动创建 `.env.local` 文件并配置API密钥。

### 方法二：手动创建

1. 在项目根目录创建 `.env.local` 文件
2. 复制以下内容到文件中：

```env
# DeepSeek API配置（用于生成故事脚本）
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 七牛云API配置（用于生成绘本图像）
QINIU_API_KEY=your_qiniu_api_key_here

# OpenAI API配置（用于图像生成，可选，已使用七牛云）
# OPENAI_API_KEY=your_openai_api_key_here
```

3. 保存文件

## 必需配置

### 1. DeepSeek API密钥
应用的核心功能需要DeepSeek API来生成故事脚本。

**已配置的API密钥：** *请在部署环境配置，勿在仓库中存放*

如果使用其他API密钥，请：
1. 访问 [DeepSeek官网](https://www.deepseek.com/) 注册账号
2. 获取API密钥
3. 在 `.env.local` 文件中替换 `DEEPSEEK_API_KEY` 的值

### 2. 七牛云API密钥（用于图像生成）
应用使用七牛云文生图API（kling-v1模型）来生成绘本图像。

**已配置的API密钥：** *请在部署环境配置，勿在仓库中存放*

**API信息：**
- API接入点：`https://api.qnaigc.com/v1`
- 接口名：`/images/generations`
- 模型ID：`kling-v1`

如果使用其他API密钥，请：
1. 访问 [七牛云AI平台](https://www.qiniu.com/) 注册账号
2. 获取API密钥
3. 在 `.env.local` 文件中替换 `QINIU_API_KEY` 的值

## 可选配置

### OpenAI API密钥（备用图像生成选项）
如果你想使用OpenAI DALL-E而不是七牛云，可以配置：

1. 访问 [OpenAI官网](https://platform.openai.com/) 注册账号
2. 获取API密钥
3. 在 `.env.local` 文件中添加：

```env
OPENAI_API_KEY=your_openai_api_key_here
```

4. 修改 `lib/imageGenerator.ts` 中的 `generateComicPageImage` 函数，使用OpenAI API

**注意**：当前默认使用七牛云API，如需切换请修改代码。

## 验证配置

创建 `.env.local` 文件后，请：

1. **重启开发服务器**（如果正在运行）：
   ```bash
   # 停止当前服务器 (Ctrl+C)
   # 然后重新启动
   npm run dev
   ```

2. **测试API连接**：
   - 在应用中尝试生成一个故事脚本
   - 尝试生成绘本图像（会调用七牛云API）
   - 如果看到错误，检查：
     - `.env.local` 文件是否在项目根目录
     - API密钥是否正确（没有多余空格）
     - 开发服务器是否已重启
     - 七牛云API密钥是否有效（图像生成需要较长时间，请耐心等待）

## 故障排除

### 问题：仍然提示"环境变量未设置"

**解决方案：**
1. 确认 `.env.local` 文件在项目根目录（与 `package.json` 同级）
2. 确认文件内容格式正确（`DEEPSEEK_API_KEY=sk-...`，等号两边没有空格）
3. **重启开发服务器**（重要！Next.js 只在启动时读取环境变量）
4. 检查文件名是否正确（`.env.local`，注意开头的点）

### 问题：API调用失败

**可能原因：**
- API密钥无效或已过期
- 网络连接问题
- API服务暂时不可用

**解决方案：**
- 检查API密钥是否有效
- 查看浏览器控制台和服务器日志的错误信息
- 确认网络连接正常

## 注意事项

- `.env.local` 文件不会被提交到Git（已在.gitignore中）
- 确保API密钥的安全性，不要泄露给他人
- 某些API可能有使用限制和费用，请查看相应的服务条款
- **重要**：修改 `.env.local` 后必须重启开发服务器才能生效

