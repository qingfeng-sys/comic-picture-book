import axios from 'axios';
import { GenerationModel, WAN_GENERATION_MODELS } from '@/types';

const WAN_API_BASE = 'https://dashscope.aliyuncs.com/api/v1';
const WAN_SERVICE_PATH = '/services/aigc/text2image/image-synthesis';
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
    process.env.QWEN_API_KEY ||
    (process.env as any).QWEN_API_KEY;

  if (!apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY / QWEN_API_KEY，无法调用通义万相文生图');
  }
  return apiKey;
}

export function isWanGenerationModel(model?: GenerationModel | string): model is GenerationModel {
  return !!model && WAN_GENERATION_MODELS.includes(model as GenerationModel);
}

interface WanSubmitOptions {
  model: GenerationModel;
  negative_prompt?: string;
  size?: string;
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

  if (options.negative_prompt) {
    payload.input.negative_prompt = options.negative_prompt;
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-DashScope-Async': 'enable',
  };

  const response = await http.post(WAN_SERVICE_PATH, payload, { headers });
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
  }
): Promise<string> {
  const model = options?.model && isWanGenerationModel(options.model)
    ? options.model
    : WAN_GENERATION_MODELS[0];

  const submitResult = await submitWanImageTask(prompt, {
    model,
    negative_prompt: options?.negative_prompt,
    size: options?.size,
  });

  if (submitResult.imageUrl) {
    return submitResult.imageUrl;
  }

  if (!submitResult.taskId) {
    throw new Error('未能获取通义万相任务ID');
  }

  return waitForWanTaskResult(submitResult.taskId);
}
