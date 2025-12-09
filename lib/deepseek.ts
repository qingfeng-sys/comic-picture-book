import axios from 'axios';
import { StoryboardData } from '@/types';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 调用DeepSeek API生成脚本
 */
export async function generateScriptWithDeepSeek(
  userPrompt: string,
  conversationHistory: DeepSeekMessage[] = []
): Promise<string> {
  // 调试信息：检查环境变量
  console.log('=== 环境变量调试信息 ===');
  console.log('process.env.DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置');
  console.log('所有环境变量键:', Object.keys(process.env).filter(k => k.includes('DEEPSEEK')));
  console.log('当前工作目录:', process.cwd());
  console.log('========================');
  
  // 优先使用环境变量，如果没有则使用后备密钥（临时解决方案）
  const apiKey = process.env.DEEPSEEK_API_KEY || 'sk-7184f5ee339047b98aff5b1d7d1e2b81';
  
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY环境变量未设置，请在.env.local文件中配置API密钥');
  }
  
  console.log('使用API密钥:', apiKey.substring(0, 10) + '...' + (apiKey.length > 20 ? apiKey.substring(apiKey.length - 4) : ''));

  // 优化系统提示词，让AI生成更适合漫画绘本的脚本
  const systemPrompt = `你是一个专业的故事脚本创作助手，专门为漫画绘本创作故事脚本。

创作要求：
1. 脚本长度控制在10页左右，每页内容简洁明了
2. 每页脚本格式：以"第X页："开头，包含场景描述和对话
3. 场景描述要生动具体，适合用图像表现
4. 对话要简洁有趣，符合卡通风格
5. 故事要有清晰的起承转合结构
6. 语言风格：适合儿童阅读，温馨有趣

脚本格式示例：
第1页：
[场景：阳光明媚的早晨，小兔子在花园里]
小兔子："今天天气真好，我要去探险！"

请根据用户的描述，生成一个完整的故事脚本。`;

  // 构建消息列表
  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userPrompt },
  ];

  try {
    console.log('正在调用DeepSeek API生成脚本...');
    
    const response = await axios.post<DeepSeekResponse>(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.8, // 提高创造性
        max_tokens: 3000, // 增加最大token数，确保生成完整脚本
        stream: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 60000, // 60秒超时
      }
    );

    // 检查响应数据
    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      throw new Error('API返回数据格式异常');
    }

    const content = response.data.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error('API返回内容为空');
    }

    // 记录token使用情况
    if (response.data.usage) {
      console.log('Token使用情况:', response.data.usage);
    }

    console.log('脚本生成成功，长度:', content.length, '字符');
    return content.trim();
  } catch (error: any) {
    console.error('DeepSeek API调用失败:', error);
    
    // 更详细的错误处理
    if (error.response) {
      // API返回了错误响应
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 401) {
        throw new Error('API密钥无效，请检查DEEPSEEK_API_KEY是否正确');
      } else if (status === 429) {
        throw new Error('API调用频率过高，请稍后再试');
      } else if (status === 500) {
        throw new Error('DeepSeek服务器错误，请稍后重试');
      } else {
        throw new Error(`API错误 (${status}): ${errorData?.error?.message || '未知错误'}`);
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      throw new Error('无法连接到DeepSeek API，请检查网络连接');
    } else {
      // 其他错误
      throw new Error(`请求配置错误: ${error.message}`);
    }
  }
}

/**
 * 生成结构化分镜数据（JSON格式）
 */
export async function generateStoryboardWithDeepSeek(
  userPrompt: string,
  conversationHistory: DeepSeekMessage[] = []
): Promise<StoryboardData> {
  // 调试信息：检查环境变量
  console.log('=== 生成结构化分镜 ===');
  console.log('process.env.DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置');
  
  const apiKey = process.env.DEEPSEEK_API_KEY || 'sk-7184f5ee339047b98aff5b1d7d1e2b81';
  
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY环境变量未设置，请在.env.local文件中配置API密钥');
  }

  // 系统提示词：强制输出纯JSON，不允许任何自然语言
  const systemPrompt = `你是一个JSON数据生成器。你的任务是根据用户的故事描述，生成结构化的漫画分镜JSON数据。

**严格规则：**
1. 只输出JSON对象，不要包含任何解释、说明、markdown代码块标记或其他文字
2. 不要输出markdown代码块标记（如三个反引号）
3. 不要输出任何自然语言说明
4. 直接输出JSON对象，格式必须完全符合以下Schema

**输出格式（必须是这个结构）：**
{
  "frames": [
    {
      "frame_id": 1,
      "image_prompt": "场景描述，用于生成图片",
      "dialogues": [
        {
          "role": "角色名",
          "text": "这句话真的会显示在气泡里",
          "anchor": "left",
          "x_ratio": 0.25,
          "y_ratio": 0.35
        }
      ],
      "narration": "只允许旁白"
    }
  ]
}

**字段说明：**
- frames: 分镜帧数组
- frame_id: 分镜帧编号，从1开始递增
- image_prompt: 图片生成提示词，描述场景、角色、动作，要具体生动
- dialogues: 对话数组，每个对话包含：
  - role: 说话角色名称
  - text: 对话内容（这句话会直接显示在气泡里，不要包含角色名）
  - anchor: 气泡对齐方式，"left"（左侧对齐）、"right"（右侧对齐）或"center"（居中）
  - x_ratio: 角色头部X坐标，0~1（0.0=最左侧，1.0=最右侧）
  - y_ratio: 角色头部Y坐标，0~1（0.0=最顶部，1.0=最底部）
- narration: 旁白文字（可选），只允许旁白，不要包含对话内容

**anchor规则：**
- 左侧角色（x_ratio < 0.5）通常用 "left"
- 右侧角色（x_ratio > 0.5）通常用 "right"
- 居中角色用 "center"

**坐标建议：**
- 左侧角色：x_ratio = 0.2~0.4, y_ratio = 0.3~0.5
- 右侧角色：x_ratio = 0.6~0.8, y_ratio = 0.3~0.5
- 居中角色：x_ratio = 0.4~0.6, y_ratio = 0.3~0.5

**示例输出（直接复制这个格式）：**
{
  "frames": [
    {
      "frame_id": 1,
      "image_prompt": "阳光明媚的早晨，小兔子站在花园里，周围是五颜六色的花朵",
      "dialogues": [
        {
          "role": "小兔子",
          "text": "今天天气真好，我要去探险！",
          "anchor": "left",
          "x_ratio": 0.3,
          "y_ratio": 0.4
        }
      ],
      "narration": "小兔子决定去森林探险"
    }
  ]
}

现在开始，只输出JSON对象，不要任何其他内容。`;

  // 构建消息列表
  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userPrompt },
  ];

  try {
    console.log('正在调用DeepSeek API生成分镜数据...');
    
    const response = await axios.post<DeepSeekResponse>(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.7, // 降低温度，确保JSON格式准确
        max_tokens: 4000,
        stream: false,
        // 注意：DeepSeek API可能不支持response_format参数，通过prompt强制JSON输出
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      throw new Error('API返回数据格式异常');
    }

    let content = response.data.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error('API返回内容为空');
    }

    // 清理内容：移除可能的markdown代码块标记和前后空白
    content = content.trim();
    
    // 移除 ```json 和 ``` 标记
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\s*/i, '').replace(/\s*```\s*$/i, '');
    }
    
    // 移除可能的说明文字（在JSON之前或之后）
    // 尝试找到第一个 { 和最后一个 }
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      content = content.substring(firstBrace, lastBrace + 1);
    }

    // 解析JSON
    let storyboardData: StoryboardData;
    try {
      storyboardData = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON解析失败，原始内容:', content.substring(0, 500));
      throw new Error(`JSON解析失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`);
    }

    // 验证数据结构
    if (!storyboardData || typeof storyboardData !== 'object') {
      throw new Error('返回数据必须是JSON对象');
    }
    
    if (!storyboardData.frames || !Array.isArray(storyboardData.frames)) {
      throw new Error('返回数据必须包含frames数组字段');
    }
    
    if (storyboardData.frames.length === 0) {
      throw new Error('frames数组不能为空');
    }

    // 验证每个frame的基本结构
    storyboardData.frames.forEach((frame, index) => {
      if (!frame.frame_id || typeof frame.frame_id !== 'number') {
        throw new Error(`第${index + 1}个分镜缺少frame_id或格式错误`);
      }
      if (!frame.image_prompt || typeof frame.image_prompt !== 'string') {
        throw new Error(`第${index + 1}个分镜缺少image_prompt或格式错误`);
      }
      if (!Array.isArray(frame.dialogues)) {
        throw new Error(`第${index + 1}个分镜的dialogues必须是数组`);
      }
      
      // 验证每个dialogue的结构
      frame.dialogues.forEach((dialogue, dIndex) => {
        if (!dialogue.role || typeof dialogue.role !== 'string') {
          throw new Error(`第${index + 1}个分镜的第${dIndex + 1}个对话缺少role字段`);
        }
        if (!dialogue.text || typeof dialogue.text !== 'string') {
          throw new Error(`第${index + 1}个分镜的第${dIndex + 1}个对话缺少text字段`);
        }
        if (!['left', 'right', 'center'].includes(dialogue.anchor)) {
          throw new Error(`第${index + 1}个分镜的第${dIndex + 1}个对话的anchor必须是"left"、"right"或"center"`);
        }
        if (typeof dialogue.x_ratio !== 'number' || dialogue.x_ratio < 0 || dialogue.x_ratio > 1) {
          throw new Error(`第${index + 1}个分镜的第${dIndex + 1}个对话的x_ratio必须是0~1之间的数字`);
        }
        if (typeof dialogue.y_ratio !== 'number' || dialogue.y_ratio < 0 || dialogue.y_ratio > 1) {
          throw new Error(`第${index + 1}个分镜的第${dIndex + 1}个对话的y_ratio必须是0~1之间的数字`);
        }
      });
    });

    console.log(`分镜生成成功，共${storyboardData.frames.length}帧`);
    return storyboardData;
  } catch (error: any) {
    console.error('分镜生成失败:', error);
    
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 401) {
        throw new Error('API密钥无效，请检查DEEPSEEK_API_KEY是否正确');
      } else if (status === 429) {
        throw new Error('API调用频率过高，请稍后再试');
      } else if (status === 500) {
        throw new Error('DeepSeek服务器错误，请稍后重试');
      } else {
        throw new Error(`API错误 (${status}): ${errorData?.error?.message || '未知错误'}`);
      }
    } else if (error.request) {
      throw new Error('无法连接到DeepSeek API，请检查网络连接');
    } else {
      throw error; // 重新抛出解析错误等
    }
  }
}

/**
 * 继续对话，完善脚本
 * 在对话模式下，系统提示词会稍微调整，更注重修改和完善
 */
export async function continueConversation(
  userMessage: string,
  conversationHistory: DeepSeekMessage[]
): Promise<string> {
  // 在对话模式下，使用更灵活的提示词
  const systemPrompt = `你是一个专业的故事脚本创作助手。用户正在完善一个漫画绘本脚本。

请根据用户的反馈和要求，修改和完善脚本。保持脚本的格式（每页以"第X页："开头），确保内容适合制作成漫画绘本。`;

  // 构建新的消息列表，替换系统提示词
  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  // 调试信息：检查环境变量
  console.log('=== 环境变量调试信息（继续对话） ===');
  console.log('process.env.DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置');
  console.log('====================================');
  
  // 优先使用环境变量，如果没有则使用后备密钥（临时解决方案）
  const apiKey = process.env.DEEPSEEK_API_KEY || 'sk-7184f5ee339047b98aff5b1d7d1e2b81';
  
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY环境变量未设置');
  }

  try {
    console.log('继续对话，完善脚本...');
    
    const response = await axios.post<DeepSeekResponse>(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.8,
        max_tokens: 3000,
        stream: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      throw new Error('API返回数据格式异常');
    }

    const content = response.data.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error('API返回内容为空');
    }

    console.log('脚本完善成功');
    return content.trim();
  } catch (error: any) {
    console.error('对话失败:', error);
    
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      if (status === 401) {
        throw new Error('API密钥无效，请检查DEEPSEEK_API_KEY是否正确');
      } else if (status === 429) {
        throw new Error('API调用频率过高，请稍后再试');
      } else {
        throw new Error(`API错误 (${status}): ${errorData?.error?.message || '未知错误'}`);
      }
    } else if (error.request) {
      throw new Error('无法连接到DeepSeek API，请检查网络连接');
    } else {
      throw new Error(`请求配置错误: ${error.message}`);
    }
  }
}

