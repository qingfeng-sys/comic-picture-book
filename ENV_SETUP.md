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
# DashScope API配置（用于生成故事大纲/剧本/分镜）
DASHSCOPE_API_KEY=your_dashscope_api_key_here

# 七牛云API配置（用于生成绘本图像）
QINIU_API_KEY=your_qiniu_api_key_here

# 可选：启用调用前密钥校验（会增加一次额外调用，可能产生费用）
# ENABLE_API_KEY_VERIFICATION=true

# （可选）DashScope 文本生成超时（毫秒，模型较大/高峰期可适当加大）
# DASHSCOPE_SCRIPT_TIMEOUT_MS=90000
# DASHSCOPE_STORYBOARD_TIMEOUT_MS=120000
```

3. 保存文件

## 必需配置

### 1. DashScope API密钥（必需）
应用的核心功能需要 DashScope 文本生成来生成故事大纲/剧本/分镜。

**已配置的API密钥：** *请在部署环境配置，勿在仓库中存放*

请在部署环境通过环境变量提供自己的 `DASHSCOPE_API_KEY`，不要把真实密钥写入仓库。

### 2. 七牛云API密钥（必需，用于图像生成）
应用使用七牛云文生图 API 生成绘本图像。

**已配置的API密钥：** *请在部署环境配置，勿在仓库中存放*

**API信息（参考）：**
- API接入点：`https://api.qnaigc.com/v1`
- 接口名：`/images/generations`

如果使用其他API密钥，请：
1. 访问 [七牛云AI平台](https://www.qiniu.com/) 注册账号
2. 获取API密钥
3. 在 `.env.local` 文件中替换 `QINIU_API_KEY` 的值

## 可选配置

### DashScope 文本生成超时
如果在高峰期/大模型场景下偶发超时，可以在 `.env.local` 增加（单位：毫秒）：
- `DASHSCOPE_SCRIPT_TIMEOUT_MS`
- `DASHSCOPE_STORYBOARD_TIMEOUT_MS`

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

