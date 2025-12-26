import axios from 'axios';

const VOLCANO_ARK_API_URL = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

export interface VolcanoArkImageOptions {
  model: string;
  size?: string;
  image_reference?: string | string[];
  watermark?: boolean;
}

/**
 * 获取火山方舟 API Key
 */
function getVolcanoArkApiKey(): string {
  const key = process.env.VOLCANO_ARK_API_KEY || (process.env as any).VOLCANO_ARK_API_KEY;
  if (!key) {
    console.warn('VOLCANO_ARK_API_KEY 未配置，火山引擎调用将失败');
  }
  return key || '';
}

/**
 * 使用火山方舟（即梦/Seedream）生成图像
 */
export async function generateImageWithVolcanoArk(
  prompt: string,
  options: VolcanoArkImageOptions
): Promise<string> {
  const apiKey = getVolcanoArkApiKey();
  if (!apiKey) throw new Error('VOLCANO_ARK_API_KEY 未配置');

  // 构造请求体
  const payload: Record<string, any> = {
    model: options.model,
    prompt: prompt,
    response_format: 'url',
    watermark: options.watermark ?? false,
    size: options.size || '2048x2048',
  };

  // 处理参考图：火山文档中参数名为 image，支持字符串或数组
  if (options.image_reference) {
    payload.image = options.image_reference;
  }

  try {
    console.log(`[VolcanoArk] 正在调用模型 ${options.model}, 提示词长度: ${prompt.length}`);
    
    const response = await axios.post(VOLCANO_ARK_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 120000, // 图像生成通常较慢，设置 2 分钟超时
    });

    if (response.status !== 200) {
      throw new Error(`火山方舟请求失败: ${response.statusText} (${response.status})`);
    }

    const data = response.data;
    if (data.error) {
      throw new Error(`火山方舟 API 错误: ${data.error.message || data.error.code}`);
    }

    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error('火山方舟未返回图片 URL');
    }

    return imageUrl;
  } catch (error: any) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error('[VolcanoArk] 生成图像失败:', errorMsg);
    throw new Error(`火山方舟生成失败: ${errorMsg}`);
  }
}

/**
 * 检查是否为火山方舟模型
 */
export function isVolcanoArkModel(modelId: string): boolean {
  return modelId.startsWith('doubao-seedream-') || modelId.includes('seededit-');
}

