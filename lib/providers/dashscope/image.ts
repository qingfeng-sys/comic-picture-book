import axios from 'axios';
import { GenerationModel, WAN_GENERATION_MODELS } from '@/types';

const WAN_API_BASE = 'https://dashscope.aliyuncs.com/api/v1';
const WAN_SERVICE_PATH = '/services/aigc/text2image/image-synthesis';
const WAN_I2I_SERVICE_PATH = '/services/aigc/image2image/image-synthesis';

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
  image_reference?: string;
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

export async function submitWanImageTask(prompt: string, options: WanSubmitOptions): Promise<WanSubmitResult> {
  const apiKey = resolveWanApiKey();
  const cleanPrompt = normalizePrompt(prompt);

  // 构建请求Payload
  const payload: any = {
    model: options.model,
    input: {
      prompt: cleanPrompt,
    },
    parameters: {
      size: options.size || '1024*1024',
      n: 1,
    },
  };

  // 根据模型选择不同的服务路径和参数结构
  let servicePath = WAN_SERVICE_PATH;

  // I2I 模型 (wan2.5-i2i-preview)
  if (options.model === 'wan2.5-i2i-preview') {
    servicePath = WAN_I2I_SERVICE_PATH;
    // I2I 模型需要 images 数组参数
    if (options.image_reference) {
      payload.input.images = [options.image_reference];
    }
    // I2I 模型通常不需要 size (会跟随原图或默认)，但也可能支持
    // 确保 prompt_extend 参数开启（参考 curl 示例）
    payload.parameters.prompt_extend = true;
  }
  
  // T2I 模型 (wanx-v1 等)
  else {
    // wanx-v1 支持 ref_img
    if (options.model === 'wanx-v1' && options.image_reference) {
      payload.input.ref_img = options.image_reference;
    }
  }

  if (options.negative_prompt) {
    payload.input.negative_prompt = options.negative_prompt;
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-DashScope-Async': 'enable',
  };

  const response = await http.post(servicePath, payload, { headers });
  const data = response.data || {};

  const taskId =
    data?.output?.task_id ||
    data?.task_id ||
    data?.data?.task_id ||
    data?.id;

  const immediateUrl =
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
    image_reference?: string;
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


