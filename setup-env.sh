#!/bin/bash
# 创建.env.local文件的Bash脚本

ENV_FILE=".env.local"

if [ -f "$ENV_FILE" ]; then
    echo "警告: .env.local 文件已存在"
    read -p "是否要覆盖? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        exit 1
    fi
fi

cat > "$ENV_FILE" << 'EOF'
# DeepSeek API配置
DEEPSEEK_API_KEY=sk-7184f5ee339047b98aff5b1d7d1e2b81

# OpenAI API配置（用于图像生成，可选）
# OPENAI_API_KEY=your_openai_api_key_here
EOF

echo "✓ .env.local 文件已创建！"
echo ""
echo "文件内容:"
cat "$ENV_FILE"
echo ""
echo "提示: 请重启开发服务器以使环境变量生效"

