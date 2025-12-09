# 漫画绘本创作应用

一个功能强大的漫画绘本创作工具，支持AI生成故事脚本和自动生成卡通风格漫画绘本。

## 功能特性

### 1. 脚本生成功能
- 用户只需描述故事主题或详细情节
- 通过DeepSeek API智能生成故事脚本
- 支持对话交互，逐步完善和确定最终脚本

### 2. 漫画绘本生成功能
- 支持引用应用生成的故事脚本
- 支持外部导入已有脚本
- 自动生成卡通风格的漫画绘本
- 每次最多生成10页
- 自动切分超长脚本（10页为单位）并编号

## 技术栈

- **前端框架**: Next.js 14 + React 18
- **样式**: Tailwind CSS
- **语言**: TypeScript
- **API集成**: DeepSeek API (脚本生成)

## 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量：
创建 `.env.local` 文件，添加以下配置：
```
DEEPSEEK_API_KEY=your_deepseek_api_key_here
OPENAI_API_KEY=your_openai_api_key_here  # 用于图像生成（可选）
```

3. 运行开发服务器：
```bash
npm run dev
```

4. 打开浏览器访问：
```
http://localhost:3000
```

## 项目结构

```
comic-picture-book/
├── app/                    # Next.js App Router
│   ├── api/               # API路由
│   │   ├── script/        # 脚本生成相关API
│   │   └── comic/         # 绘本生成相关API
│   ├── page.tsx           # 首页
│   └── layout.tsx         # 布局组件
├── components/            # React组件
│   ├── ScriptGenerator/   # 脚本生成组件
│   ├── ComicGenerator/   # 绘本生成组件
│   └── ChatInterface/    # 对话交互组件
├── lib/                   # 工具函数
│   ├── deepseek.ts       # DeepSeek API客户端
│   ├── scriptUtils.ts    # 脚本处理工具
│   └── imageGenerator.ts # 图像生成工具
└── types/                 # TypeScript类型定义
```

## 使用说明

### 生成故事脚本
1. 在首页选择"生成脚本"
2. 输入故事描述或主题
3. 与AI对话，完善脚本内容
4. 确认最终脚本并保存

### 生成漫画绘本
1. 选择已保存的脚本或导入外部脚本
2. 如果脚本超过10页，系统会自动切分
3. 选择要生成的脚本片段序号
4. 点击生成，等待绘本创建完成

## 注意事项

- 需要配置DeepSeek API密钥才能使用脚本生成功能
- 绘本生成功能需要图像生成API支持（如OpenAI DALL-E、Stable Diffusion等）
- 建议在网络良好的环境下使用，以确保API调用成功

