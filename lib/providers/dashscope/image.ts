import axios from 'axios';
import { GenerationModel, WAN_GENERATION_MODELS } from '@/types';

const WAN_API_BASE = 'https://dashscope.aliyuncs.com/api/v1';
const WAN_SERVICE_PATH = '/services/aigc/text2image/image-synthesis';
const WAN_I2I_SERVICE_PATH = '/services/aigc/image2image/image-synthesis';
// 2.6 系列专用路径
const WAN_26_SERVICE_PATH = '/services/aigc/image-generation/generation';
const REQUEST_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 40; // 约2分钟

const http = axios.create({
  baseURL: WAN_API_BASE,
  timeout: REQUEST_TIMEOUT_MS,
});

function resolveWanApiKey(): string {
  const apiKey =
    process.env.DASHSCOPE_API_KEY ||
    (process.env as any).DASHSCOPE_API_KEY ||
    process.env.QWEN_API_KEY || // 兼容旧命名
    (process.env as any).QWEN_API_KEY;

  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY（或兼容的 QWEN_API_KEY），无法调用通义万相文生图');
  }
  return apiKey;
}

type WanGenerationModel = (typeof WAN_GENERATION_MODELS)[number];

export function isWanGenerationModel(model?: GenerationModel | string): model is WanGenerationModel {
  return !!model && WAN_GENERATION_MODELS.includes(model as WanGenerationModel);
}

interface WanSubmitOptions {
  model: WanGenerationModel;
  negative_prompt?: string;
  size?: string;
  /**
   * 参考图（仅 wanx-v1 支持）
   * 说明：DashScope 万相的参考图字段以控制台文档为准；这里按 image_reference 透传。
   */
  image_reference?: string | string[];
}

interface WanSubmitResult {
  taskId?: string;
  status?: string;
  imageUrl?: string;
}

interface WanTaskResult {
  status?: string;
  imageUrl?: string;
  message?: string;
}

function normalizePrompt(prompt: string): string {
  return prompt
    .replace(/\r+/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900); // 预留空间给附加参数，避免过长
}

function normalizeI2IImageInput(image: string): string {
  // DashScope i2i 的 input.images 通常支持：公网 URL 或 base64(dataURL)。
  // 实测 DataInspection 对“媒体格式识别”更依赖 dataURL（包含 MIME），
  // 使用 base64:// 可能会被判定为无法识别格式。
  if (!image) return image;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('data:')) {
    // 保留完整 dataURL（例如 data:image/jpeg;base64,...），便于服务端审查识别媒体格式
    return image;
  }
  // 其他情况原样返回，让 API 报错并在日志中体现
  return image;
}

export async function submitWanImageTask(prompt: string, options: WanSubmitOptions): Promise<WanSubmitResult> {
  const apiKey = resolveWanApiKey();
  const cleanPrompt = normalizePrompt(prompt);

  let payload: any;
  let servicePath = WAN_SERVICE_PATH;

  // 1. 针对 wan2.6-image 的多模态/多图参考处理
  if (options.model === 'wan2.6-image') {
    servicePath = WAN_26_SERVICE_PATH;
    const contents: any[] = [{ text: cleanPrompt }];
    
    // 如果有参考图，按 messages 格式注入
    if (options.image_reference) {
      const refs = Array.isArray(options.image_reference) ? options.image_reference : [options.image_reference];
      // 根据文档：当 enable_interleave=false (参考图生图) 时，必须输入 1~3 张图像
      refs.slice(0, 3).forEach(ref => {
        contents.push({ image: normalizeI2IImageInput(ref) });
      });
    }

    payload = {
      model: options.model,
      input: {
        messages: [
          {
            role: 'user',
            content: contents
          }
        ]
      },
      parameters: {
        size: options.size || '1024*1024',
        n: 1,
        // enable_interleave: false 代表“参考图模式”，true 代表“图文混合模式”
        enable_interleave: options.image_reference ? false : true,
        prompt_extend: true,
        watermark: false
      }
    };
  } else {
    // 2. 传统模型的平铺结构兼容
    payload = {
      model: options.model,
      input: {
        prompt: cleanPrompt,
      },
      parameters: {
        size: options.size || '1024*1024',
        n: 1,
      },
    };

    // I2I 专用路径：wan2.5-i2i-preview
    if (options.model === 'wan2.5-i2i-preview') {
      servicePath = WAN_I2I_SERVICE_PATH;
      delete payload.parameters.size;
      payload.parameters.prompt_extend = true;
      if (options.image_reference) {
        const refs = Array.isArray(options.image_reference) ? options.image_reference : [options.image_reference];
        payload.input.images = refs.map((r) => normalizeI2IImageInput(r));
      }
    }

    // T2I + ref 兼容：wanx-v1
    if (options.model === 'wanx-v1' && options.image_reference && !Array.isArray(options.image_reference)) {
      payload.input.ref_img = options.image_reference;
    }
    
    // negative_prompt 注入
    if (options.model !== 'wan2.5-i2i-preview' && options.negative_prompt) {
      payload.input.negative_prompt = options.negative_prompt;
    }
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-DashScope-Async': 'enable',
  };

  let data: any;
  try {
    const response = await http.post(servicePath, payload, { headers });
    data = response.data || {};
  } catch (err: any) {
    const status = err?.response?.status;
    const respData = err?.response?.data;
    const brief = typeof respData === 'string' ? respData.slice(0, 500) : JSON.stringify(respData)?.slice(0, 500);
    throw new Error(`DashScope 万相请求失败${status ? ` (${status})` : ''}: ${brief || err.message || err}`);
  }

  const taskId =
    data?.output?.task_id ||
    data?.task_id ||
    data?.data?.task_id ||
    data?.id;

  const immediateUrl =
    data?.output?.choices?.[0]?.message?.content?.[0]?.image ||
    data?.output?.results?.[0]?.url ||
    data?.output?.results?.[0]?.image_url ||
    data?.output?.image_url ||
    data?.image_url;

  const status =
    data?.output?.task_status ||
    data?.task_status ||
    data?.status;

  if (immediateUrl) {
    return { imageUrl: immediateUrl, status: status || 'succeeded' };
  }

  if (!taskId) {
    throw new Error('通义万相API未返回任务ID');
  }

  return { taskId, status };
}

export async function getWanTaskResult(taskId: string): Promise<WanTaskResult> {
  const apiKey = resolveWanApiKey();
  const headers = {
    Authorization: `Bearer ${apiKey}`,
  };

  const response = await http.get(`/tasks/${taskId}`, { headers });
  const data = response.data || {};
  const output = data.output || data.data || {};

  const status =
    output.task_status ||
    output.status ||
    data.status ||
    data.task_status;

  const imageUrl =
    output.choices?.[0]?.message?.content?.[0]?.image ||
    output.results?.[0]?.url ||
    output.results?.[0]?.image_url ||
    output.image_url ||
    data.image_url;

  const message = output.message || data.message;

  return { status, imageUrl, message };
}

export async function waitForWanTaskResult(
  taskId: string,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<string> {
  const intervalMs = options?.intervalMs ?? POLL_INTERVAL_MS;
  const maxAttempts = options?.maxAttempts ?? MAX_POLL_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await getWanTaskResult(taskId);
    const status = (result.status || '').toLowerCase();

    if (result.imageUrl) {
      return result.imageUrl;
    }

    if (['failed', 'error', 'stopped', 'canceled', 'cancelled'].includes(status)) {
      throw new Error(`通义万相任务失败: ${result.message || status}`);
    }

    if (status === 'succeeded' || status === 'success' || status === 'completed') {
      throw new Error('任务完成但未返回图片URL，请检查通义万相响应');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('通义万相任务轮询超时');
}

export async function generateImageWithWan(
  prompt: string,
  options?: {
    model?: GenerationModel;
    negative_prompt?: string;
    size?: string;
    image_reference?: string | string[];
  }
): Promise<string> {
  const model = options?.model && isWanGenerationModel(options.model)
    ? options.model
    : WAN_GENERATION_MODELS[0];

  const submitResult = await submitWanImageTask(prompt, {
    model,
    negative_prompt: options?.negative_prompt,
    size: options?.size,
    image_reference: options?.image_reference,
  });

  if (submitResult.imageUrl) {
    return submitResult.imageUrl;
  }

  if (!submitResult.taskId) {
    throw new Error('未能获取通义万相任务ID');
  }

  return waitForWanTaskResult(submitResult.taskId);
}


