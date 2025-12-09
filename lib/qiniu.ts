import axios from 'axios';
import { GenerationModel } from '@/types';

const QINIU_API_BASE = 'https://api.qnaigc.com/v1';
const DEFAULT_MODEL: GenerationModel = 'gemini-2.5-flash-image';

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
  id?: string;
  status?: string;
  created_at?: string | number;
  completed_at?: string | number;
  data?: {
    task_id: string;
    task_status: string;
    images?: Array<{
      url: string;
      width: number;
      height: number;
    }>;
    created_at: number;
    updated_at: number;
  };
  output?: {
    image_url: string;
  };
}

export interface QiniuSubmitResult {
  imageUrl?: string;
  taskId?: string;
  status?: string;
}

function resolveQiniuApiKey(): string {
  let apiKey = process.env.QINIU_API_KEY;

  if (!apiKey && (process.env as any).QINIU_API_KEY) {
    apiKey = (process.env as any).QINIU_API_KEY;
  }

  if (!apiKey && process.env.NODE_ENV === 'development') {
    console.warn('⚠️ 环境变量未加载，使用临时默认值（仅开发环境）');
    apiKey = 'sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe';
  }

  if (!apiKey) {
    throw new Error('QINIU_API_KEY环境变量未设置，请在.env.local文件中配置API密钥');
  }

  if (!apiKey.startsWith('sk-')) {
    console.warn('⚠️ API密钥格式可能不正确（通常以 sk- 开头）');
  }

  return apiKey;
}

/**
 * 验证七牛云API密钥是否有效
 * 通过发送一个简单的测试请求来验证
 */
export async function verifyQiniuApiKey(apiKey: string): Promise<boolean> {
  try {
    // 发送一个最简单的测试请求
    const testRequestBody = {
      model: 'kling-v1',
      prompt: 'test',
      aspect_ratio: '1:1',
      human_fidelity: 1,
    };
    
    const response = await axios.post(
      `${QINIU_API_BASE}/images/generations`,
      testRequestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 10000, // 10秒超时
        validateStatus: (status) => status < 500, // 接受400和401等错误，但不接受500
      }
    );
    
    // 如果返回401，说明密钥无效
    if (response.status === 401) {
      console.error('API密钥验证失败: 401 Unauthorized - 密钥无效或已过期');
      return false;
    }
    
    // 如果返回400但错误信息不是关于密钥的，可能是其他问题
    if (response.status === 400) {
      const errorData = response.data;
      if (errorData?.error?.message?.includes('unauthorized') || 
          errorData?.error?.message?.includes('invalid') ||
          errorData?.error?.message?.includes('key')) {
        console.error('API密钥验证失败: 密钥无效或权限不足');
        return false;
      }
      // 400可能是其他原因（如prompt太短），但至少密钥格式是正确的
      console.log('API密钥格式正确（400错误可能是其他原因）');
      return true;
    }
    
    // 200或201表示成功
    if (response.status === 200 || response.status === 201) {
      console.log('API密钥验证成功');
      return true;
    }
    
    return false;
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.error('API密钥验证失败: 401 Unauthorized');
      return false;
    }
    // 其他错误可能是网络问题等，不一定是密钥问题
    console.warn('API密钥验证时出现错误（可能是网络问题）:', error.message);
    return false;
  }
}

/**
 * 提交七牛云文生图任务（支持同步与异步模型）
 * gemini-2.5-flash-image：同步；kling-v1：异步返回 task_id
 */
export async function submitQiniuImageTask(
  prompt: string,
  options?: {
    negative_prompt?: string;
    aspect_ratio?: string;
    human_fidelity?: number;
    cfg_scale?: number;
    mode?: string;
    model?: GenerationModel;
  }
): Promise<QiniuSubmitResult> {
  const apiKey = resolveQiniuApiKey();
  const model = options?.model || DEFAULT_MODEL;

  // 可选：验证API密钥
  if (process.env.ENABLE_API_KEY_VERIFICATION === 'true') {
    const isValid = await verifyQiniuApiKey(apiKey);
    if (!isValid) {
      throw new Error('API密钥验证失败，请检查密钥是否正确或是否有图像生成权限');
    }
  }

  const cleanPrompt = prompt
    .replace(/\n+/g, ' ')
    .replace(/\r+/g, ' ')
    .replace(/\t+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？：；、\[\]（）()]/g, '')
    .trim();

  const maxLength = 500;
  const finalPrompt = cleanPrompt.length > maxLength
    ? cleanPrompt.substring(0, maxLength).trim()
    : cleanPrompt;

  if (finalPrompt.length === 0) {
    throw new Error('清理后的提示词为空，请检查输入内容');
  }

  const requestBody: any = {
    model,
    prompt: finalPrompt,
  };

  if (options?.negative_prompt && options.negative_prompt.trim()) {
    requestBody.negative_prompt = options.negative_prompt.trim();
  }
  if (options?.aspect_ratio) {
    requestBody.aspect_ratio = options.aspect_ratio;
  }
  if (options?.human_fidelity !== undefined) {
    requestBody.human_fidelity = options.human_fidelity;
  }
  if (options?.cfg_scale !== undefined) {
    requestBody.cfg_scale = options.cfg_scale;
  }
  if (options?.mode) {
    requestBody.mode = options.mode;
  }

  requestBody.temperature = 0.8;
  requestBody.top_p = 0.95;

  try {
    console.log(`正在提交七牛云文生图任务，模型: ${model}`);

    const response = await axios.post<QiniuTaskResponse>(
      `${QINIU_API_BASE}/images/generations`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );

    const responseData = response.data as any;

    if (!responseData) {
      throw new Error('API响应格式错误：响应数据为空');
    }

    if (responseData.error) {
      const errorMessage = responseData.error.message || '未知错误';
      const errorType = responseData.error.type || '';
      throw new Error(`API错误: ${errorMessage}${errorType ? ` (${errorType})` : ''}`);
    }

    let imageUrl: string | undefined;
    let base64Data: string | undefined;
    let taskId: string | undefined;
    let status: string | undefined;

    status = responseData.data?.task_status || responseData.status || responseData.task_status;
    taskId = responseData.data?.task_id || responseData.task_id;

    if (Array.isArray(responseData.data) && responseData.data.length > 0) {
      const firstItem = responseData.data[0];
      imageUrl = firstItem.url || firstItem.image_url;
      base64Data = firstItem.b64_json || firstItem.b64;
    } else if (responseData.images && Array.isArray(responseData.images) && responseData.images.length > 0) {
      const firstImage = responseData.images[0];
      imageUrl = firstImage.url || firstImage.image_url;
      base64Data = firstImage.b64_json || firstImage.b64;
    } else if (responseData.url) {
      imageUrl = responseData.url;
    } else if (responseData.image_url) {
      imageUrl = responseData.image_url;
    } else if (responseData.data && typeof responseData.data === 'string') {
      base64Data = responseData.data;
    } else if (responseData.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data)) {
      imageUrl = responseData.data.url || responseData.data.image_url;
      base64Data = responseData.data.b64_json || responseData.data.b64;
      taskId = taskId || responseData.data.task_id;
      status = status || responseData.data.task_status;
    } else if (responseData.b64_json || responseData.b64) {
      base64Data = responseData.b64_json || responseData.b64;
    } else if (typeof responseData.data === 'string' && responseData.data.length > 100) {
      base64Data = responseData.data;
    } else {
      for (const key in responseData) {
        if (typeof responseData[key] === 'string' && responseData[key].length > 500) {
          base64Data = responseData[key];
          break;
        }
      }
    }

    if (base64Data) {
      const outputFormat = responseData.output_format || 'png';
      const mimeType = outputFormat === 'png'
        ? 'image/png'
        : outputFormat === 'jpg' || outputFormat === 'jpeg'
          ? 'image/jpeg'
          : 'image/png';
      imageUrl = `data:${mimeType};base64,${base64Data}`;
    }

    if (imageUrl) {
      return { imageUrl, taskId, status };
    }

    if (taskId) {
      console.log('收到异步任务ID，需要轮询获取结果，task_id:', taskId);
      return { taskId, status };
    }

    throw new Error('API响应格式错误：无法找到图片URL或task_id。');
  } catch (error: any) {
    console.error('七牛云API调用失败:', error);

    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;

      if (statusCode === 400) {
        const errorObj = errorData?.error || errorData;
        const errorMsg =
          (errorObj && typeof errorObj === 'object' && (errorObj.message || errorObj.type)) ||
          errorData?.message ||
          JSON.stringify(errorData);

        throw new Error(
          `请求参数错误 (400): ${errorMsg}\n提示词长度: ${finalPrompt.length}字符\n请检查请求参数格式是否正确。`
        );
      } else if (statusCode === 401) {
        throw new Error('API密钥无效，请检查QINIU_API_KEY是否正确');
      } else if (statusCode === 429) {
        throw new Error('API调用频率过高，请稍后再试');
      } else if (statusCode === 500) {
        throw new Error('七牛云服务器错误，请稍后重试');
      } else {
        throw new Error(`API错误 (${statusCode}): ${errorData?.message || JSON.stringify(errorData)}`);
      }
    } else if (error.request) {
      throw new Error('无法连接到七牛云API，请检查网络连接');
    } else if (error.message) {
      throw error;
    } else {
      throw new Error(`请求配置错误: ${error.message || JSON.stringify(error)}`);
    }
  }
}

/**
 * 查询七牛云任务结果
 */
export async function getQiniuTaskResult(taskId: string): Promise<{ status: string; imageUrl?: string }> {
  const apiKey = resolveQiniuApiKey();

  try {
    const response = await axios.get<QiniuTaskResult>(
      `${QINIU_API_BASE}/images/tasks/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const data = response.data;
    const status =
      data.data?.task_status ||
      data.status ||
      (data as any).task_status ||
      'unknown';

    const imageUrl =
      data.data?.images?.[0]?.url ||
      data.output?.image_url ||
      (data as any).image_url ||
      (data as any).images?.[0]?.url;

    return { status, imageUrl };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { status: 'not_found' };
    }
    if (error.response?.status === 401) {
      throw new Error('API密钥无效，无法查询任务状态');
    }
    console.warn(`查询任务时出现错误，将重试: ${error.message}`);
    return { status: 'retry' };
  }
}

export async function waitForQiniuTaskResult(
  taskId: string,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<string> {
  const intervalMs = options?.intervalMs ?? 2000;
  const maxAttempts = options?.maxAttempts ?? 40;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await getQiniuTaskResult(taskId);
    const status = result.status?.toLowerCase();

    if (result.imageUrl) {
      console.log(`任务 ${taskId} 完成，已获取图片`);
      return result.imageUrl;
    }

    if (status === 'failed' || status === 'error' || status === 'failure' || status === 'rejected') {
      throw new Error(`任务生成失败: ${status}`);
    }

    if (status === 'not_found' || status === 'retry') {
      // 任务还未就绪或请求异常，稍后重试
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }

    if (status === 'succeeded' || status === 'success' || status === 'completed') {
      throw new Error('任务已完成但未获取到图片URL，请检查API响应格式');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('任务轮询超时，请稍后再试');
}

/**
 * 生成图片（自动根据模型选择同步/异步流程）
 */
export async function generateImageWithQiniu(
  prompt: string,
  options?: {
    negative_prompt?: string;
    aspect_ratio?: string;
    human_fidelity?: number;
    cfg_scale?: number;
    mode?: string;
    model?: GenerationModel;
  }
): Promise<string> {
  console.log(`🚀 开始生成图片，模型: ${options?.model || DEFAULT_MODEL}`);
  const submitResult = await submitQiniuImageTask(prompt, options);

  if (submitResult.imageUrl) {
    console.log('✅ 图片生成完成（同步）');
    return submitResult.imageUrl;
  }

  if (submitResult.taskId) {
    const imageUrl = await waitForQiniuTaskResult(submitResult.taskId, {
      intervalMs: 2000,
      maxAttempts: 40,
    });
    console.log('✅ 图片生成完成（异步）');
    return imageUrl;
  }

  throw new Error('未能获得图片URL或任务ID');
}
