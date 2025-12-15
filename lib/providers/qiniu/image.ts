import axios from 'axios';
import { GenerationModel } from '@/types';

const QINIU_API_BASE = 'https://api.qnaigc.com/v1';
const DEFAULT_MODEL: GenerationModel = 'gemini-2.5-flash-image';
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_TIMES = 2;
const PLACEHOLDER_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAKUlEQVR4nO3BMQEAAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAL4G0jAAAZWoaFkAAAAASUVORK5CYII='; // 64x64 白底

const http = axios.create({
  baseURL: QINIU_API_BASE,
  timeout: REQUEST_TIMEOUT_MS,
});

async function withRetry<T>(fn: () => Promise<T>, retries = RETRY_TIMES): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt === retries) break;
      const backoff = 200 * Math.pow(2, attempt); // 指数退避
      await new Promise(res => setTimeout(res, backoff));
    }
  }
  throw lastError;
}

export interface QiniuImageGenerationRequest {
  model?: string;  // 模型ID，例如 'kling-v1'（兼容OpenAI格式，使用小写）
  prompt: string;
  n?: number;  // 生成图像数量，默认为1
  size?: string;  // 图像尺寸，格式为 'widthxheight'，例如 '512x512'
  response_format?: 'url' | 'b64_json';  // 响应格式
  negative_prompt?: string;
  aspect_ratio?: string;
  human_fidelity?: number;
  cfg_scale?: number;  // 控制生成图像的自由度，范围 [0, 1]
  mode?: string;  // 生成模式：'std'（标准）或 'pro'（高品质）
  image_reference?: string;
}

export interface QiniuTaskResponse {
  code?: number;
  message?: string;
  request_id?: string;
  data?: {
    task_id?: string;
    task_status?: string;
    created_at?: number;
    updated_at?: number;
    // 同步响应格式（OpenAI兼容）
    url?: string;
    image_url?: string;
  } | Array<{
    url?: string;
    image_url?: string;
  }>;
  error?: {
    message: string;
    type: string;
  };
  // 支持直接返回task_id的格式（异步模式）
  task_id?: string;
  // 支持直接返回URL的格式（同步模式）
  url?: string;
  image_url?: string;
  // OpenAI兼容格式
  images?: Array<{
    url: string;
    image_url?: string;
  }>;
}

export interface QiniuTaskResult {
  code?: number;
  message?: string;
  request_id?: string;
  data?: {
    task_id?: string;
    task_status?: string;
    created_at?: number;
    updated_at?: number;
    // 结果列表
    results?: Array<{
      url?: string;
      image_url?: string;
      b64_json?: string;
    }>;
    // 兼容不同返回结构
    url?: string;
    image_url?: string;
  };
  // OpenAI兼容格式
  images?: Array<{
    url: string;
    image_url?: string;
    b64_json?: string;
  }>;
}

function resolveQiniuApiKey(): string {
  const key =
    process.env.QINIU_API_KEY ||
    (process.env as any).QINIU_API_KEY;
  if (!key) {
    throw new Error('未配置 QINIU_API_KEY，无法调用七牛云文生图');
  }
  return key;
}

function normalizeImageUrl(data: any): string | null {
  // OpenAI兼容: images[0].url
  const fromImages = data?.images?.[0]?.url || data?.images?.[0]?.image_url;
  if (fromImages) return fromImages;

  // 兼容: data.url / data.image_url
  const fromData =
    data?.data?.url ||
    data?.data?.image_url ||
    data?.url ||
    data?.image_url;
  if (fromData) return fromData;

  // 兼容: data 是数组
  const fromArray = Array.isArray(data?.data) ? (data.data[0]?.url || data.data[0]?.image_url) : null;
  if (fromArray) return fromArray;

  return null;
}

async function pollTask(taskId: string): Promise<string> {
  const apiKey = resolveQiniuApiKey();
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // Qiniu AI 平台任务查询（兼容不同路径）
  const tryUrls = [`/tasks/${taskId}`, `/images/tasks/${taskId}`, `/image/tasks/${taskId}`];
  let lastError: any;
  for (let i = 0; i < 30; i++) {
    for (const url of tryUrls) {
      try {
        const res = await http.get<QiniuTaskResult>(url, { headers, validateStatus: () => true });
        if (res.status >= 200 && res.status < 300) {
          const status =
            (res.data as any)?.data?.task_status ||
            (res.data as any)?.task_status ||
            (res.data as any)?.status;

          const imageUrl =
            (res.data as any)?.data?.results?.[0]?.url ||
            (res.data as any)?.data?.results?.[0]?.image_url ||
            (res.data as any)?.images?.[0]?.url ||
            (res.data as any)?.images?.[0]?.image_url;

          if (imageUrl) return imageUrl;

          if (status && ['failed', 'error', 'canceled', 'cancelled', 'stopped'].includes(String(status).toLowerCase())) {
            throw new Error(`七牛任务失败: ${status}`);
          }
        }
      } catch (err) {
        lastError = err;
      }
    }
    await new Promise(res => setTimeout(res, 1500));
  }
  throw lastError || new Error('七牛任务轮询超时');
}

/**
 * 七牛云文生图（兼容同步/异步两种形态）
 */
export async function generateImageWithQiniu(
  prompt: string,
  options?: Partial<QiniuImageGenerationRequest> & { model?: GenerationModel | string }
): Promise<string> {
  const apiKey = resolveQiniuApiKey();
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const model = options?.model || DEFAULT_MODEL;
  const payload: QiniuImageGenerationRequest = {
    model: String(model),
    prompt,
    n: options?.n ?? 1,
    size: options?.size,
    response_format: options?.response_format ?? 'url',
    negative_prompt: options?.negative_prompt,
    aspect_ratio: options?.aspect_ratio,
    human_fidelity: options?.human_fidelity,
    cfg_scale: options?.cfg_scale,
    mode: options?.mode,
    image_reference: options?.image_reference,
  };

  try {
    const resp = await withRetry(() =>
      http.post<QiniuTaskResponse>('/images/generations', payload, { headers, validateStatus: () => true })
    );

    if (resp.status < 200 || resp.status >= 300) {
      const msg = (resp.data as any)?.error?.message || (resp.data as any)?.message || resp.statusText;
      throw new Error(`七牛请求失败(${resp.status}): ${msg}`);
    }

    const directUrl = normalizeImageUrl(resp.data);
    if (directUrl) return directUrl;

    // 异步任务
    const taskId =
      (resp.data as any)?.data?.task_id ||
      (resp.data as any)?.task_id ||
      (resp.data as any)?.id;

    if (taskId) {
      return await pollTask(taskId);
    }

    // 兜底
    return PLACEHOLDER_IMAGE;
  } catch (error) {
    console.error('七牛文生图失败:', error);
    return PLACEHOLDER_IMAGE;
  }
}


