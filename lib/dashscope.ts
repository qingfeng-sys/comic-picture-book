import axios from 'axios';

export type DashScopeRole = 'system' | 'user' | 'assistant';

export interface DashScopeMessage {
  role: DashScopeRole;
  content: string;
}

export interface DashScopeChatOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  enable_thinking?: boolean;
  seed?: number;
  /**
   * 客户端请求超时（毫秒）。仅用于 HTTP 客户端，不会下发给模型参数。
   * 大模型（72B/80B）在高峰期经常需要 >20s，建议按阶段设置更高超时。
   */
  requestTimeoutMs?: number;
}

interface DashScopeResponse {
  request_id?: string;
  output?: {
    choices?: Array<{
      message?: { role?: string; content?: string };
      finish_reason?: string;
    }>;
    text?: string; // 兼容少数返回形态
  };
  usage?: unknown;
}

const DASHSCOPE_API_URL =
  process.env.DASHSCOPE_TEXT_API_URL ||
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

const DEFAULT_TIMEOUT_MS = Number(process.env.DASHSCOPE_TIMEOUT_MS || 60_000);
const RETRY_TIMES = Number(process.env.DASHSCOPE_RETRY_TIMES || 1);

async function withRetry<T>(fn: () => Promise<T>, retries = RETRY_TIMES): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt === retries) break;
      const backoff = 250 * Math.pow(2, attempt);
      await new Promise(res => setTimeout(res, backoff));
    }
  }
  throw lastError;
}

function getDashScopeApiKey(): string {
  const key =
    process.env.DASHSCOPE_API_KEY ||
    (process.env as any).DASHSCOPE_API_KEY ||
    process.env.QWEN_API_KEY || // 兼容旧命名
    (process.env as any).QWEN_API_KEY;
  if (!key) throw new Error('DASHSCOPE_API_KEY未配置');
  return key;
}

export interface DashScopeChatResult {
  content: string;
  model: string;
  requestId?: string;
}

/**
 * DashScope 文本生成（推荐的 text-generation/generation 端点）
 * - 使用 messages 形态输入
 * - 输出优先从 output.choices[0].message.content 读取
 */
export async function dashscopeChat(
  model: string,
  messages: DashScopeMessage[],
  options: DashScopeChatOptions = {}
): Promise<DashScopeChatResult> {
  const apiKey = getDashScopeApiKey();

  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  // requestTimeoutMs 仅用于 HTTP 客户端，不能作为模型 parameters 透传
  const { requestTimeoutMs: _ignored, ...modelOptions } = options;

  const parameters: Record<string, any> = {
    result_format: 'message',
    ...modelOptions,
  };

  const payload = {
    model,
    input: { messages },
    parameters,
  };

  const resp = await withRetry(() =>
    axios.post<DashScopeResponse>(DASHSCOPE_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: requestTimeoutMs,
      validateStatus: () => true,
    })
  );

  if (resp.status < 200 || resp.status >= 300) {
    const msg = (resp.data as any)?.message || (resp.data as any)?.code || resp.statusText;
    throw new Error(`DashScope请求失败(${resp.status}): ${msg}`);
  }

  const content =
    resp.data?.output?.choices?.[0]?.message?.content?.trim() ||
    resp.data?.output?.text?.trim();

  if (!content) {
    throw new Error('DashScope 返回空内容');
  }

  return {
    content,
    model,
    requestId: resp.data?.request_id,
  };
}


