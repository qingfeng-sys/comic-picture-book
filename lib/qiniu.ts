import axios from 'axios';

const QINIU_API_BASE = 'https://api.qnaigc.com/v1';

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
 * 提交七牛云文生图任务（同步返回图片URL）
 * 根据七牛云API文档，使用gemini-2.5-flash-image模型，同步返回结果
 */
export async function submitQiniuImageTask(
  prompt: string,
  options?: {
    negative_prompt?: string;
    aspect_ratio?: string;
    human_fidelity?: number;
  }
): Promise<string> {
  // 调试信息：检查环境变量
  console.log('=== 七牛云API环境变量调试 ===');
  console.log('process.env.QINIU_API_KEY:', process.env.QINIU_API_KEY ? '已设置' : '未设置');
  console.log('所有环境变量键:', Object.keys(process.env).filter(k => k.includes('QINIU') || k.includes('API')));
  
  // 尝试多种方式获取API密钥
  let apiKey = process.env.QINIU_API_KEY;
  
  // 如果环境变量未设置，尝试从 next.config.js 的 env 配置中获取
  if (!apiKey && (process.env as any).QINIU_API_KEY) {
    apiKey = (process.env as any).QINIU_API_KEY;
  }
  
  // 临时后备方案（仅用于开发环境，如果环境变量无法加载）
  if (!apiKey && process.env.NODE_ENV === 'development') {
    console.warn('⚠️ 环境变量未加载，使用临时默认值（仅开发环境）');
    apiKey = 'sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe';
  }
  
  if (!apiKey) {
    console.error('QINIU_API_KEY 未找到，可用的环境变量:', Object.keys(process.env).join(', '));
    throw new Error('QINIU_API_KEY环境变量未设置，请在.env.local文件中配置API密钥');
  }
  
  // 验证API密钥格式（七牛云API密钥通常以 'sk-' 开头）
  if (!apiKey.startsWith('sk-')) {
    console.warn('⚠️ API密钥格式可能不正确（通常以 sk- 开头）');
  }
  
  // 输出API密钥前几位用于调试（不输出完整密钥）
  console.log('API密钥前缀:', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4));
  
  // 可选：验证API密钥（仅在开发环境且第一次调用时）
  // 注意：这会增加一次API调用，可能产生费用，所以默认关闭
  // 如果需要启用，可以设置环境变量 ENABLE_API_KEY_VERIFICATION=true
  if (process.env.ENABLE_API_KEY_VERIFICATION === 'true') {
    console.log('正在验证API密钥...');
    const isValid = await verifyQiniuApiKey(apiKey);
    if (!isValid) {
      throw new Error('API密钥验证失败，请检查密钥是否正确或是否有图像生成权限');
    }
  }

  // 清理和规范化 prompt
  // 移除所有特殊字符和多余空白，确保API能正确解析
  const cleanPrompt = prompt
    .replace(/\n+/g, ' ')  // 移除换行符，替换为空格
    .replace(/\r+/g, ' ')  // 移除回车符
    .replace(/\t+/g, ' ')  // 移除制表符
    .replace(/\s+/g, ' ')  // 多个空格合并为一个
    // 保留常用标点符号，只移除可能引起问题的特殊字符
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？：；、\[\]（）()]/g, '') 
    .trim();
  
  // 限制长度（七牛云API可能有长度限制，设置为500字符更安全）
  const maxLength = 500;
  const finalPrompt = cleanPrompt.length > maxLength 
    ? cleanPrompt.substring(0, maxLength).trim()
    : cleanPrompt;
  
  if (finalPrompt.length === 0) {
    throw new Error('清理后的提示词为空，请检查输入内容');
  }
  
  // 构建请求体，根据七牛云API文档格式（兼容OpenAI格式）
  // 根据示例，使用 gemini-2.5-flash-image 模型，同步返回结果
  const requestBody: any = {
    model: 'gemini-2.5-flash-image',  // 使用正确的模型名称
    prompt: finalPrompt,
  };
  
  // 添加可选的高级参数（根据示例）
  if (options?.negative_prompt && options.negative_prompt.trim()) {
    requestBody.negative_prompt = options.negative_prompt.trim();
  }
  
  // 采样参数（根据示例）
  requestBody.temperature = 0.8;  // 默认温度
  requestBody.top_p = 0.95;  // 默认top_p
  
  // 注意：根据示例，API是同步返回结果的，不需要aspect_ratio和human_fidelity参数

  try {
    console.log('正在提交七牛云文生图任务...');
    console.log('请求URL:', `${QINIU_API_BASE}/images/generations`);
    console.log('提示词长度:', finalPrompt.length, '字符');
    console.log('请求体:', JSON.stringify(requestBody, null, 2));
    
    const response = await axios.post<QiniuTaskResponse>(
      `${QINIU_API_BASE}/images/generations`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 30000, // 30秒超时
      }
    );

    // 输出完整响应（但截断过长的base64数据以便查看结构）
    const responseForLog = JSON.parse(JSON.stringify(response.data));
    if (responseForLog.data && Array.isArray(responseForLog.data)) {
      responseForLog.data = responseForLog.data.map((item: any) => {
        if (item.b64_json && item.b64_json.length > 100) {
          return { ...item, b64_json: item.b64_json.substring(0, 100) + '... (truncated)' };
        }
        if (item.b64 && item.b64.length > 100) {
          return { ...item, b64: item.b64.substring(0, 100) + '... (truncated)' };
        }
        return item;
      });
    }
    console.log('API响应结构:', JSON.stringify(responseForLog, null, 2));
    
    const responseData = response.data as any;

    // 检查响应格式
    if (!responseData) {
      throw new Error('API响应格式错误：响应数据为空');
    }

    // 检查是否有错误字段（优先检查error字段）
    if (responseData.error) {
      const errorMessage = responseData.error.message || '未知错误';
      const errorType = responseData.error.type || '';
      throw new Error(`API错误: ${errorMessage}${errorType ? ` (${errorType})` : ''}`);
    }

    // 根据示例，API是同步返回结果的，格式应该类似OpenAI：
    // { data: [{ url: "..." }] } 或 { data: [{ b64_json: "..." }] } 或 base64字符串
    let imageUrl: string | undefined;
    let base64Data: string | undefined;
    
    // 尝试多种可能的响应格式（按优先级）
    // 1. OpenAI标准格式: { data: [{ url: "..." }] } 或 { data: [{ b64_json: "..." }] }
    if (Array.isArray(responseData.data) && responseData.data.length > 0) {
      const firstItem = responseData.data[0];
      imageUrl = firstItem.url || firstItem.image_url;
      base64Data = firstItem.b64_json || firstItem.b64;
      if (imageUrl) {
        console.log('✅ 使用OpenAI格式解析，找到图片URL');
      } else if (base64Data) {
        console.log('✅ 使用OpenAI格式解析，找到base64数据');
      }
    }
    // 2. 七牛云格式: { images: [{ url: "..." }] } 或直接返回base64字符串
    else if (responseData.images && Array.isArray(responseData.images) && responseData.images.length > 0) {
      const firstImage = responseData.images[0];
      imageUrl = firstImage.url || firstImage.image_url;
      base64Data = firstImage.b64_json || firstImage.b64;
      if (imageUrl) {
        console.log('✅ 使用七牛云格式解析，找到图片URL');
      } else if (base64Data) {
        console.log('✅ 使用七牛云格式解析，找到base64数据');
      }
    }
    // 3. 直接返回URL: { url: "..." }
    else if (responseData.url) {
      imageUrl = responseData.url;
      console.log('✅ 使用直接URL格式解析，找到图片URL');
    }
    // 4. 直接返回image_url: { image_url: "..." }
    else if (responseData.image_url) {
      imageUrl = responseData.image_url;
      console.log('✅ 使用image_url格式解析，找到图片URL');
    }
    // 5. 直接返回base64字符串（在data字段中）
    else if (responseData.data && typeof responseData.data === 'string') {
      base64Data = responseData.data;
      console.log('✅ 使用直接base64字符串格式解析');
    }
    // 6. 嵌套格式: { data: { url: "..." } } 或 { data: { b64_json: "..." } }
    else if (responseData.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data)) {
      imageUrl = responseData.data.url || responseData.data.image_url;
      base64Data = responseData.data.b64_json || responseData.data.b64;
      if (imageUrl) {
        console.log('✅ 使用嵌套data格式解析，找到图片URL');
      } else if (base64Data) {
        console.log('✅ 使用嵌套data格式解析，找到base64数据');
      }
    }
    // 7. 检查是否有直接的base64字段
    else if (responseData.b64_json || responseData.b64) {
      base64Data = responseData.b64_json || responseData.b64;
      console.log('✅ 使用直接base64字段解析');
    }
    // 8. 检查data字段是否是直接的base64字符串（不是数组也不是对象）
    else if (typeof responseData.data === 'string' && responseData.data.length > 100) {
      // 可能是base64字符串
      base64Data = responseData.data;
      console.log('✅ 使用data字段中的base64字符串解析');
    }
    // 9. 检查响应中是否有任何看起来像base64的长字符串字段
    else {
      // 遍历所有字段，查找可能是base64的字符串
      for (const key in responseData) {
        if (typeof responseData[key] === 'string' && responseData[key].length > 500) {
          // 可能是base64数据
          base64Data = responseData[key];
          console.log(`✅ 在字段 "${key}" 中找到可能的base64数据`);
          break;
        }
      }
    }
    
    // 如果找到base64数据，转换为data URL
    if (base64Data) {
      const outputFormat = responseData.output_format || 'png';
      const mimeType = outputFormat === 'png' ? 'image/png' : outputFormat === 'jpg' || outputFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
      imageUrl = `data:${mimeType};base64,${base64Data}`;
      console.log(`✅ 将base64数据转换为data URL (格式: ${outputFormat})`);
    }
    
    if (imageUrl) {
      console.log('✅ 图片生成成功！URL长度:', imageUrl.length, '字符');
      if (imageUrl.startsWith('data:')) {
        console.log('📸 返回base64 data URL');
      } else {
        console.log('🔗 返回图片URL:', imageUrl.substring(0, 100) + '...');
      }
      return imageUrl; // 直接返回图片URL或data URL，不需要异步查询
    }
    
    // 如果没有找到图片URL，检查是否是异步任务模式（返回task_id）
    let taskId: string | undefined;
    if (responseData.data?.task_id) {
      taskId = responseData.data.task_id;
    } else if (responseData.task_id) {
      taskId = responseData.task_id;
    }
    
    if (taskId) {
      console.log('⚠️ API返回了task_id，可能需要异步查询，task_id:', taskId);
      // 返回task_id，让调用方知道需要异步查询
      throw new Error(`API返回异步任务模式，task_id: ${taskId}。当前实现需要修改以支持异步查询。`);
    }
    
    // 如果既没有图片URL也没有task_id，说明响应格式不符合预期
    console.error('API响应格式不符合预期:', JSON.stringify(responseData, null, 2));
    throw new Error('API响应格式错误：无法找到图片URL或task_id。响应数据：' + JSON.stringify(responseData));
  } catch (error: any) {
    console.error('七牛云API调用失败:', error);
    
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      
      // 输出详细的错误信息
      console.error('错误状态码:', status);
      console.error('错误响应:', JSON.stringify(errorData, null, 2));
      
      if (status === 400) {
        // 400错误可能是参数问题或服务器内部错误
        const errorObj = errorData?.error || errorData;
        let errorMsg = '';
        
        if (errorObj && typeof errorObj === 'object') {
          errorMsg = errorObj.message || errorObj.type || JSON.stringify(errorObj);
        } else if (errorData?.message) {
          errorMsg = errorData.message;
        } else {
          errorMsg = JSON.stringify(errorData);
        }
        
        // 如果是内部服务器错误，给出更友好的提示
        if (errorMsg.includes('internal_server_error') || errorMsg.includes('generate image failed')) {
          const promptPreview = finalPrompt.length > 100 
            ? finalPrompt.substring(0, 100) + '...' 
            : finalPrompt;
          const apiKeyPreview = apiKey ? (apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4)) : '未设置';
          
          throw new Error(
            `七牛云API内部错误 (400): 图像生成失败\n\n` +
            `可能的原因：\n` +
            `1. API密钥无效或权限不足（当前密钥: ${apiKeyPreview}）\n` +
            `2. 模型名称 'kling-v1' 不正确或当前不可用\n` +
            `3. API服务暂时不可用\n` +
            `4. prompt内容不符合要求\n\n` +
            `诊断信息：\n` +
            `- 提示词长度: ${finalPrompt.length}字符\n` +
            `- 提示词预览: ${promptPreview}\n` +
            `- 请求URL: ${QINIU_API_BASE}/images/generations\n` +
            `- 请求格式: 已使用七牛云标准格式（model, prompt, aspect_ratio, human_fidelity）\n\n` +
            `建议操作：\n` +
            `1. 检查API密钥是否有效（访问七牛云控制台确认）\n` +
            `2. 确认API密钥有图像生成权限\n` +
            `3. 检查七牛云服务状态\n` +
            `4. 稍后重试`
          );
        }
        
        throw new Error(
          `请求参数错误 (400): ${errorMsg}\n` +
          `提示词长度: ${finalPrompt.length}字符\n` +
          `请检查请求参数格式是否正确。`
        );
      } else if (status === 401) {
        throw new Error('API密钥无效，请检查QINIU_API_KEY是否正确');
      } else if (status === 429) {
        throw new Error('API调用频率过高，请稍后再试');
      } else if (status === 500) {
        throw new Error('七牛云服务器错误，请稍后重试');
      } else {
        throw new Error(`API错误 (${status}): ${errorData?.message || JSON.stringify(errorData)}`);
      }
    } else if (error.request) {
      throw new Error('无法连接到七牛云API，请检查网络连接');
    } else if (error.message) {
      // 如果是我们抛出的错误，直接传递
      throw error;
    } else {
      throw new Error(`请求配置错误: ${error.message || JSON.stringify(error)}`);
    }
  }
}

/**
 * 查询七牛云任务结果
 */
export async function getQiniuTaskResult(taskId: string): Promise<string | null> {
  // 使用与 submitQiniuImageTask 相同的API密钥获取逻辑
  let apiKey = process.env.QINIU_API_KEY;
  
  if (!apiKey && (process.env as any).QINIU_API_KEY) {
    apiKey = (process.env as any).QINIU_API_KEY;
  }
  
  if (!apiKey && process.env.NODE_ENV === 'development') {
    apiKey = 'sk-164c03ec2bcc2dbbb82bbf703ceb8dd334c97b75cddf933e68cfc753803fcabe';
  }
  
  if (!apiKey) {
    console.error('getQiniuTaskResult: QINIU_API_KEY 未设置');
    throw new Error('QINIU_API_KEY环境变量未设置');
  }

  try {
    // 尝试多种查询方式
    // 方式1: GET /images/generations/{task_id} (标准方式)
    // 方式2: GET /images/generations?task_id={task_id} (查询参数)
    // 方式3: GET /batchjob/inference/{task_id} (批量推理端点，可能用于某些任务)
    
    // 尝试多种查询方式和端点
    const queryMethods = [
      // 方式1: GET /images/generations/{task_id}
      {
        method: 'GET',
        url: `${QINIU_API_BASE}/images/generations/${taskId}`,
        description: 'GET路径参数方式'
      },
      // 方式2: GET /images/generations?task_id={task_id}
      {
        method: 'GET',
        url: `${QINIU_API_BASE}/images/generations`,
        params: { task_id: taskId },
        description: 'GET查询参数方式'
      },
      // 方式3: POST /images/generations (某些API可能需要POST查询)
      {
        method: 'POST',
        url: `${QINIU_API_BASE}/images/generations/${taskId}`,
        description: 'POST路径参数方式'
      },
      // 方式4: POST /images/generations with body
      {
        method: 'POST',
        url: `${QINIU_API_BASE}/images/generations`,
        data: { task_id: taskId },
        description: 'POST请求体方式'
      },
    ];
    
    let response;
    let lastError: any = null;
    let triedMethods: string[] = [];
    
    // 尝试所有可能的查询方式
    for (const method of queryMethods) {
      try {
        triedMethods.push(method.description);
        console.log(`🔍 尝试查询方式: ${method.description} - ${method.method} ${method.url}`);
        
        const config: any = {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        };
        
        if (method.params) {
          config.params = method.params;
        }
        
        if (method.method === 'GET') {
          response = await axios.get<QiniuTaskResult>(method.url, config);
        } else {
          response = await axios.post<QiniuTaskResult>(
            method.url, 
            method.data || {}, 
            config
          );
        }
        
        // 如果成功，跳出循环
        console.log(`✅ 查询成功！使用方式: ${method.description}`);
        break;
      } catch (error: any) {
        lastError = error;
        if (error.response?.status === 404) {
          console.log(`❌ ${method.description} 返回404，尝试下一个...`);
          continue; // 尝试下一个方式
        } else if (error.response?.status === 405) {
          // 405 Method Not Allowed，说明这个方法不支持，继续尝试
          console.log(`❌ ${method.description} 返回405（方法不允许），尝试下一个...`);
          continue;
        } else {
          // 其他错误（如401、403等），输出但继续尝试
          console.log(`⚠️ ${method.description} 返回错误 ${error.response?.status}: ${error.message}`);
          // 如果是认证错误，直接抛出
          if (error.response?.status === 401 || error.response?.status === 403) {
            throw error;
          }
          continue;
        }
      }
    }
    
    // 如果所有方式都返回404，说明任务可能还未创建或端点不正确
    if (!response && lastError?.response?.status === 404) {
      console.log(`⚠️ 所有查询方式都返回404:`);
      triedMethods.forEach(m => console.log(`   - ${m}`));
      console.log(`可能的原因：`);
      console.log(`   1. 任务ID格式不正确: ${taskId}`);
      console.log(`   2. API端点不正确，需要查看七牛云最新文档`);
      console.log(`   3. 任务还未创建，需要等待更长时间`);
      console.log(`   4. 该API可能不支持主动查询，需要等待回调通知`);
      return null;
    }
    
    // 如果没有response，说明所有尝试都失败了
    if (!response) {
      console.error(`❌ 所有查询方式都失败，最后错误:`, lastError?.message);
      throw lastError || new Error('无法查询任务状态');
    }

    const data = response.data;
    
    // 输出详细响应用于调试
    console.log(`查询任务 ${taskId} 状态，响应:`, JSON.stringify(data, null, 2));
    
    // 处理多种可能的响应格式
    // 格式1: { code: 0, data: { task_status, images } }
    // 格式2: { id, status, output: { image_url } }
    // 格式3: { task_status, images: [...] } (直接返回)
    // 格式4: { status, image_url } (简化格式)
    
    let taskStatus: string | undefined;
    let imageUrl: string | undefined;
    
    // 检查格式1：标准格式
    if (data.code !== undefined) {
      if (data.code !== 0) {
        throw new Error(`API错误: ${data.message || '未知错误'}`);
      }
      if (data.data) {
        taskStatus = data.data.task_status;
        if (data.data.images && data.data.images.length > 0) {
          imageUrl = data.data.images[0].url;
        }
      }
    } 
    // 检查格式2：OpenAI兼容格式
    else if (data.status !== undefined) {
      taskStatus = data.status;
      if (data.output && data.output.image_url) {
        imageUrl = data.output.image_url;
      }
    }
    // 检查格式3：直接返回task_status
    else if ((data as any).task_status !== undefined) {
      taskStatus = (data as any).task_status;
      if ((data as any).images && Array.isArray((data as any).images) && (data as any).images.length > 0) {
        imageUrl = (data as any).images[0].url;
      }
    }
    // 检查格式4：简化格式，直接有image_url
    else if ((data as any).image_url) {
      imageUrl = (data as any).image_url;
      taskStatus = 'completed';
    }
    
    console.log(`任务状态: ${taskStatus || '未知'}, 图片URL: ${imageUrl || '未生成'}`);
    
    // 判断任务状态
    if (imageUrl) {
      return imageUrl; // 返回图片URL
    } else if (taskStatus === 'submitted' || taskStatus === 'processing' || taskStatus === 'pending' || taskStatus === 'running') {
      // 任务还在处理中，返回null表示需要继续轮询
      return null;
    } else if (taskStatus === 'failed' || taskStatus === 'error' || taskStatus === 'failure') {
      throw new Error(`任务生成失败: ${data.message || '未知错误'}`);
    } else if (taskStatus === 'completed' || taskStatus === 'succeeded' || taskStatus === 'success') {
      // 任务完成但没有图片URL，可能是响应格式问题
      console.error('任务已完成但未获取到图片URL，响应数据:', JSON.stringify(data, null, 2));
      throw new Error('任务已完成但未获取到图片URL，请检查API响应格式');
    } else {
      // 其他状态或未定义状态，继续等待（可能是新状态）
      console.log(`未知任务状态: ${taskStatus}，继续等待...`);
      return null;
    }
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      // 任务ID不存在或还未创建，返回null继续等待
      // 注意：七牛云API可能需要一些时间才能创建任务，404是正常的
      return null;
    }
    // 输出错误详情
    console.error(`查询任务 ${taskId} 时出错:`, error.message);
    if (error.response) {
      console.error('错误状态码:', error.response.status);
      console.error('错误响应:', JSON.stringify(error.response.data, null, 2));
      
      // 如果是401，说明API密钥有问题
      if (error.response.status === 401) {
        throw new Error('API密钥无效，无法查询任务状态');
      }
      
      // 如果是403，说明没有权限
      if (error.response.status === 403) {
        throw new Error('没有权限查询任务状态');
      }
    }
    // 对于其他错误，继续重试（可能是网络问题）
    console.warn(`查询任务时出现错误，将重试: ${error.message}`);
    return null;
  }
}

/**
 * 生成图片（同步方式）
 * 根据七牛云API文档，使用gemini-2.5-flash-image模型，API同步返回结果
 * @param prompt 提示词
 * @param options 可选参数
 * @returns 图片URL
 */
export async function generateImageWithQiniu(
  prompt: string,
  options?: {
    negative_prompt?: string;
    aspect_ratio?: string;
    human_fidelity?: number;
  }
): Promise<string> {
  // 直接调用submitQiniuImageTask，它会同步返回图片URL
  // 根据示例，API是同步的，不需要异步查询
  console.log('🚀 开始生成图片（同步模式）...');
  const imageUrl = await submitQiniuImageTask(prompt, options);
  console.log('✅ 图片生成完成！URL:', imageUrl);
  return imageUrl;
}
