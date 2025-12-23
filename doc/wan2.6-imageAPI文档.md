# 通义万相 Wanx 2.6 图像生成 / 编辑 API（Cursor Agent 可直接使用）

> 本文档为工程调用精简版，已从官方文档整理完成，  
> 适合直接通过 `@file` 提供给 Cursor Agent 使用。

---

## 一、模型概览

- 模型名称：wan2.6-image
- 能力：
  - 文生图
  - 图生图 / 图像编辑（1–4 张参考图）
  - 风格迁移 / 主体一致性生成
- 支持两种调用方式：
  - HTTP 同步调用
  - HTTP 异步调用（创建任务 + 轮询）

---

## 二、HTTP 同步调用

### Endpoint

北京地域  
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation

新加坡地域  
POST https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation

---

### Headers

Content-Type: application/json  
Authorization: Bearer <DASHSCOPE_API_KEY>

如需启用图文混排 + 流式输出（enable_interleave=true），需额外设置：  
X-DashScope-Sse: enable

---

### Request Body 示例（同步 / 图像编辑模式）

{
  "model": "wan2.6-image",
  "input": {
    "messages": [
      {
        "role": "user",
        "content": [
          { "text": "参考图1的风格和图2的背景，生成番茄炒蛋" },
          { "image": "https://example.com/image1.png" },
          { "image": "https://example.com/image2.webp" }
        ]
      }
    ]
  },
  "parameters": {
    "prompt_extend": true,
    "watermark": false,
    "n": 1,
    "enable_interleave": false,
    "size": "1280*1280"
  }
}

---

### 关键参数说明

- model：固定为 wan2.6-image  
- input.messages：仅支持单轮 user 消息  
- content.text：正向提示词（必选）  
- content.image：输入图像 URL 或 Base64（1–4 张）  
- parameters.enable_interleave：
  - false：图像编辑模式（默认）
  - true：图文混排模式  
- parameters.n：生成图像数量（1–4，测试建议 1）  
- parameters.size：输出分辨率，如 1280*1280  
- parameters.prompt_extend：是否开启提示词智能改写  
- parameters.watermark：是否添加“AI生成”水印  

---

### 同步成功响应示例

{
  "output": {
    "choices": [
      {
        "finish_reason": "stop",
        "message": {
          "role": "assistant",
          "content": [
            {
              "type": "image",
              "image": "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/xxx.png"
            }
          ]
        }
      }
    ],
    "finished": true
  },
  "usage": {
    "image_count": 1,
    "size": "1280*1280"
  },
  "request_id": "xxxx"
}

说明：  
- image 为生成图像 URL  
- URL 有效期 24 小时，请及时下载并转存  

---

## 三、HTTP 异步调用（推荐生产环境）

### 调用流程

创建任务 → 轮询查询任务结果

---

### Step 1：创建任务

Endpoint（北京）  
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation

Endpoint（新加坡）  
POST https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/image-generation/generation

---

### Headers（必须）

Content-Type: application/json  
Authorization: Bearer <DASHSCOPE_API_KEY>  
X-DashScope-Async: enable

---

### Request Body

与同步调用完全一致（model / input / parameters 相同）

---

### 创建任务成功响应

{
  "output": {
    "task_id": "xxxx",
    "task_status": "PENDING"
  },
  "request_id": "xxxx"
}

---

### Step 2：查询任务结果

Endpoint（北京）  
GET https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}

Endpoint（新加坡）  
GET https://dashscope-intl.aliyuncs.com/api/v1/tasks/{task_id}

---

### Headers

Authorization: Bearer <DASHSCOPE_API_KEY>

---

### 任务状态说明

- PENDING：排队中  
- RUNNING：处理中  
- SUCCEEDED：成功（返回 image URL）  
- FAILED：失败  
- CANCELED：已取消  
- UNKNOWN：不存在或已过期  

建议轮询间隔：10 秒

---

### 任务完成成功响应示例

{
  "output": {
    "task_id": "xxxx",
    "task_status": "SUCCEEDED",
    "finished": true,
    "choices": [
      {
        "message": {
          "content": [
            {
              "type": "image",
              "image": "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/xxx.png"
            }
          ]
        }
      }
    ]
  },
  "usage": {
    "image_count": 1,
    "size": "1280*1280"
  },
  "request_id": "xxxx"
}

---

## 四、重要使用限制

- task_id 与生成图像 URL 仅保留 24 小时  
- 输入与输出均经过内容安全审核  
- 常见错误码：
  - IPInfringementSuspect
  - DataInspectionFailed
- 如系统无法访问外部 OSS，请将以下域名加入白名单：

dashscope-result-*.oss-cn-*.aliyuncs.com

---

## 五、Cursor Agent 推荐用法

@file docs/wanx_2.6_api.md  
请基于该 API 文档：  
1. 实现 Python WanxClient  
2. 同时支持同步与异步调用  
3. 异步调用包含轮询逻辑  
4. 返回最终 image URL 列表


