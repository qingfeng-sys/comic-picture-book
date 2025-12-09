# 即梦AI API 集成说明

## 概述

即梦AI提供了文生图API，可以用于生成绘本图像。该API采用异步调用方式，需要先提交任务，然后通过task_id查询结果。

## 需要提供的信息

### 1. API Token（必需）

- **获取方式**：
  1. 访问 [即梦AI官网](https://www.hidreamai.com/) 注册账号
  2. 进入用户中心，申请API权限
  3. 获取 `API_KEY`（Token）

- **配置方式**：
  在 `.env.local` 文件中添加：
  ```env
  JIMENG_API_KEY=your_jimeng_api_key_here
  ```

### 2. API 端点

- **提交任务**：`https://www.hidreamai.com/api-pub/gw/v3/image/txt2img/async`
- **查询结果**：`https://www.hidreamai.com/api-pub/gw/v3/image/txt2img/async/results`

### 3. 请求参数

#### 提交任务（POST请求）

**请求头（Headers）**：
- `Authorization`: `Bearer {您的Token}`
- `Content-Type`: `application/json`
- `API-User-ID`: 可选，用户唯一标识

**请求体（Body）**：
```json
{
  "prompt": "文本描述，用于生成图片",           // 必填
  "negative_prompt": "禁止生成的提示词",        // 可选，默认为空字符串
  "img_count": 1,                              // 可选，1-4，默认为1
  "version": "v2L",                            // 可选，模型版本，默认"v2L"
  "resolution": "1024*1024",                  // 可选，图片分辨率
  "request_id": "唯一请求ID",                  // 可选，默认为空字符串
  "notify_url": "回调通知URL"                  // 可选，任务完成后的回调接口
}
```

**模型版本说明**：
- `v2L`：标准版本
  - 支持分辨率：`1024*1024`, `832*1248`, `880*1168`, `768*1360`, `1248*832`, `1168*880`, `1360*768`
- `v2.1-standard`：高清版本
  - 支持分辨率：`2048*2048`, `1664*2496`, `1728*2304`, `1536*2688`, `2496*1664`, `2304*1728`, `2688*1536`

#### 查询结果（GET请求）

**请求参数**：
- `task_id`: 必填，提交任务后返回的任务ID
- `request_id`: 可选，请求的ID

**响应中的任务状态码（task_status）**：
- `0`: 等待中
- `1`: 完成
- `2`: 处理中
- `3`: 失败
- `4`: 结果未通过审核
- `1004`, `1005`, `1006`: 算法无生成结果（建议更换prompt）

## 调用流程

1. **提交生成任务**：发送POST请求到提交任务端点，包含prompt等参数
2. **获取task_id**：从响应中获取返回的task_id
3. **轮询查询结果**：使用task_id定期查询任务状态
4. **获取图片URL**：当任务状态为完成（status=1）时，从响应中获取生成的图片URL

## 代码集成示例

可以在 `lib/imageGenerator.ts` 的 `generateComicPageImage` 函数中集成即梦API，参考以下实现：

```typescript
// 提交即梦API任务
async function submitJimengTask(prompt: string): Promise<string> {
  const apiKey = process.env.JIMENG_API_KEY;
  if (!apiKey) {
    throw new Error('JIMENG_API_KEY环境变量未设置');
  }

  const response = await axios.post(
    'https://www.hidreamai.com/api-pub/gw/v3/image/txt2img/async',
    {
      prompt: prompt,
      negative_prompt: '',
      img_count: 1,
      version: 'v2L',
      resolution: '1024*1024',
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data.task_id;
}

// 查询即梦API结果
async function getJimengResult(taskId: string): Promise<string> {
  const apiKey = process.env.JIMENG_API_KEY;
  if (!apiKey) {
    throw new Error('JIMENG_API_KEY环境变量未设置');
  }

  const response = await axios.get(
    `https://www.hidreamai.com/api-pub/gw/v3/image/txt2img/async/results`,
    {
      params: {
        task_id: taskId,
      },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }
  );

  const { task_status, images } = response.data;
  
  if (task_status === 1 && images && images.length > 0) {
    return images[0].url; // 返回第一张图片的URL
  } else if (task_status === 0 || task_status === 2) {
    // 等待中或处理中，需要继续轮询
    throw new Error('PENDING');
  } else {
    throw new Error(`任务失败，状态码: ${task_status}`);
  }
}

// 轮询获取结果（带重试）
async function generateWithJimeng(prompt: string, maxRetries = 30): Promise<string> {
  const taskId = await submitJimengTask(prompt);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const imageUrl = await getJimengResult(taskId);
      return imageUrl;
    } catch (error: any) {
      if (error.message === 'PENDING') {
        // 等待2秒后重试
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('生成超时，请稍后重试');
}
```

## 注意事项

1. **异步处理**：即梦API是异步的，需要轮询查询结果，建议设置合理的超时时间和重试次数
2. **费用**：使用即梦API可能需要消耗积分，请查看官方定价
3. **审核**：生成的图片需要通过审核，如果审核不通过（status=4），需要重新生成
4. **提示词优化**：为了生成更好的绘本图片，建议优化prompt，包含：
   - 风格描述（如：卡通风格、儿童绘本风格）
   - 场景描述（从脚本中提取）
   - 色彩要求（如：色彩鲜艳、温馨）
   - 构图要求（如：简洁清晰、重点突出）

## 推荐配置

对于绘本生成，推荐使用以下参数：

```json
{
  "prompt": "卡通风格的绘本插图，[场景描述]，色彩鲜艳，温馨有趣，适合儿童阅读，简洁清晰的构图",
  "negative_prompt": "恐怖，暴力，成人内容",
  "img_count": 1,
  "version": "v2L",
  "resolution": "1024*1024"
}
```
