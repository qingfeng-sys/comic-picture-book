# 漫画绘本创作应用

一个AI驱动漫画绘本创作工具，支持故事脚本生成和自动生成卡通风格漫画绘本。目前定位为本地/内网演示项目，尚未接入真实后端鉴权或生产级存储。

## ✨ 功能特性

### 📝 脚本生成
- AI智能生成故事大纲/剧本/分镜（基于阿里云百炼 DashScope 文本生成）
- 对话式交互，逐步完善脚本内容
- 支持脚本编辑和保存

### 🎨 漫画生成
- 自动生成卡通风格漫画绘本
- 支持结构化分镜数据
- 自动切分长脚本（10页为单位）
- 图片自动保存和过期清理

### 👤 用户系统（演示版）
- 基于 localStorage 的本地注册/登录（无后端鉴权，不适合生产）
- 作品管理和查看
- 支持批量下载（ZIP打包）

### 📱 响应式设计
- 支持桌面端和移动端
- 流畅的SPA体验

## 🚀 快速开始

> 运行要求：Node.js 18+，自行提供有效的 DashScope / 七牛云 API Key（部署前务必用自己的密钥覆盖）。

### 安装依赖
```bash
npm install
```

### 配置环境变量

创建 `.env.local` 文件并填入以下配置：
```env
# --- 必需配置 ---
# DashScope API Key (阿里云百炼)
DASHSCOPE_API_KEY=your_dashscope_api_key_here

# 七牛云 API Key (qnaigc.com)
QINIU_API_KEY=your_qiniu_api_key_here

# --- 安全与访问控制 (可选) ---
# 是否启用 API 访问保护 (默认 false)
ENABLE_API_KEY_VERIFICATION=false
# API 访问密钥 (当启用校验时需在 Header 中携带 X-API-Key)
API_SECURITY_TOKEN=your_security_token

# --- 超时控制 (建议配置) ---
# 全局默认超时
DASHSCOPE_TIMEOUT_MS=60000
# 针对不同阶段的细分超时（高峰期建议设为 90s-120s）
DASHSCOPE_OUTLINE_TIMEOUT_MS=45000
DASHSCOPE_SCRIPT_TIMEOUT_MS=90000
DASHSCOPE_STORYBOARD_TIMEOUT_MS=120000
```

### 运行开发服务器
```bash
npm run dev
```

访问 `http://localhost:3000`

## ⚙️ 当前状态与安全性

- **安全性**: 已初步实现基于 `X-API-Key` 的接口保护、CORS 策略管理以及 API 速率限制（Rate Limiting）。
- **图片存储**: 生成的图片暂存于本地 `public/comic-assets/`，并伴随自动清理机制（7天过期）。
- **局域网支持**: 内置针对 Windows 的防火墙配置脚本，支持 0.0.0.0 监听，方便跨设备调试。
- **一致性处理**: 通过布局指令（Layout Hint）和参考图辅助（Reference Images）解决了 AI 绘图中角色站位与长相不一致的问题。

## 📖 使用指南

### 生成故事脚本
1. 登录后，选择"脚本生成"
2. 输入故事描述或主题
3. 与AI对话，完善脚本内容
4. 确认并保存脚本

### 生成漫画绘本
1. 选择"绘本生成"
2. 选择已保存的脚本或导入外部脚本
3. 系统自动切分长脚本（如需要）
4. 选择脚本片段，点击生成
5. 等待绘本创建完成，可查看和下载

## 🛠️ 技术栈

- **框架**: Next.js 16 + React 18
- **样式**: Tailwind CSS 3.3
- **安全**: 自定义 API Protection + Rate Limiter
- **AI 服务**: 
  - **文本生成**: DashScope (通义千问系列 - 支持大纲/脚本/分镜三阶段 Pipeline)
  - **图像生成**: 七牛云 API (Kling/Gemini 兼容模型) & 通义万相 (支持 i2i 参考图模式)

## 📚 文档

- **[技术框架文档](./doc/技术框架文档.md)** - 详细的技术架构、API文档、开发规范等

## ⚠️ 注意事项

- 需要配置API密钥才能使用完整功能
- 建议在网络良好的环境下使用
- 生成的图片会在7天后自动清理

## 📄 许可证

Private Project

