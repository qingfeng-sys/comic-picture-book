/**
 * 统一多模态模型配置中心
 * 核心逻辑：定义模型元数据，驱动 UI 展示、后端分流与多模态能力判断
 */

export type ModelCategory = 'text' | 'image' | 'audio-stt' | 'audio-tts';
export type ModelProvider = 'dashscope' | 'qiniu' | 'volcanoark' | 'jimeng' | 'openai';

export interface ModelCapabilities {
  // 图像模型能力
  supportRefImage?: boolean;   // 是否支持角色立绘参考图输入
  isMultiModal?: boolean;      // 是否支持多模态消息结构 (如 messages 结构)
  maxRefImages?: number;      // 最大参考图数量
  
  // 语音模型能力
  supportCloning?: boolean;    // 是否支持音色克隆
  isStreaming?: boolean;       // 是否支持流式输出
  
  // 通用状态
  isLegacy: boolean;          // 是否为老旧模型（在 UI 下拉列表中隐藏）
}

export interface ModelMetadata {
  id: string;                 // 实际调用的模型 ID
  name: string;               // 前端 UI 显示名称
  category: ModelCategory;    // 模型类别
  provider: ModelProvider;    // 归属服务商
  description: string;        // 模型能力描述
  capabilities: ModelCapabilities;
  defaultParameters?: Record<string, any>; // 该模型特有的默认参数
}

export const MODEL_REGISTRY: Record<string, ModelMetadata> = {
  // =================================================================
  // === 1. 图像生成模型 (Image) - 驱动绘本渲染与角色立绘 ===
  // =================================================================
  'wan2.6-image': {
    id: 'wan2.6-image',
    name: 'wan2.6-image （推荐）',
    category: 'image',
    provider: 'dashscope',
    description: '最新多模态模型，支持1-4张立绘参考，角色一致性极佳',
    capabilities: { supportRefImage: true, isMultiModal: true, isLegacy: false, maxRefImages: 4 },
    defaultParameters: { size: '1024*1024', prompt_extend: true }
  },
  'doubao-seedream-4.5': {
    id: 'doubao-seedream-4.5',
    name: 'doubao-seedream-4.5 （旗舰）',
    category: 'image',
    provider: 'volcanoark',
    description: '火山方舟顶尖模型，美学与一致性极高，支持14张参考图',
    capabilities: { supportRefImage: true, isMultiModal: true, isLegacy: false, maxRefImages: 14 },
    defaultParameters: { size: '2048x2048', watermark: false }
  },
  'doubao-seedream-4.0': {
    id: 'doubao-seedream-4.0',
    name: 'doubao-seedream-4.0',
    category: 'image',
    provider: 'volcanoark',
    description: '平衡性能与画质的高级生成模型',
    capabilities: { supportRefImage: true, isMultiModal: true, isLegacy: false, maxRefImages: 14 },
    defaultParameters: { size: '2048x2048', watermark: false }
  },
  'wan2.5-i2i-preview': {
    id: 'wan2.5-i2i-preview',
    name: 'wan2.5-i2i-preview',
    category: 'image',
    provider: 'dashscope',
    description: '专业图生图，适合追求极致构图参考的场景',
    capabilities: { supportRefImage: true, isMultiModal: true, isLegacy: false, maxRefImages: 1 },
  },
  'gemini-2.5-flash-image': {
    id: 'gemini-2.5-flash-image',
    name: 'gemini-2.5-flash-image',
    category: 'image',
    provider: 'qiniu',
    description: '七牛云快速生成的平衡模型',
    capabilities: { supportRefImage: true, isMultiModal: false, isLegacy: false },
  },
  'wan2.2-t2i-plus': {
    id: 'wan2.2-t2i-plus',
    name: 'wan2.2-t2i-plus',
    category: 'image',
    provider: 'dashscope',
    description: '高清文生图模型',
    capabilities: { supportRefImage: false, isMultiModal: false, isLegacy: false },
  },
  'wan2.2-t2i-flash': {
    id: 'wan2.2-t2i-flash',
    name: 'wan2.2-t2i-flash',
    category: 'image',
    provider: 'dashscope',
    description: '极速生成模型',
    capabilities: { supportRefImage: false, isMultiModal: false, isLegacy: true },
  },

  // =================================================================
  // === 2. 文本生成模型 (Text) - 驱动故事大纲与剧本创作 ===
  // =================================================================
  'qwen-max': {
    id: 'qwen-max',
    name: '通义千问 Max',
    category: 'text',
    provider: 'dashscope',
    description: '逻辑能力最强，适合大纲与结构化分镜',
    capabilities: { isLegacy: false },
  },
  'deepseek-v3': {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    category: 'text',
    provider: 'dashscope',
    description: '创意写作能力强，适合剧本生成',
    capabilities: { isLegacy: false },
  },

  // =================================================================
  // === 3. 语音模型 (Audio) - 驱动语音录入与绘本播报 ===
  // =================================================================
  'cosyvoice-v1': {
    id: 'cosyvoice-v1',
    name: '通义语音克隆',
    category: 'audio-tts',
    provider: 'dashscope',
    description: '支持音色克隆，适合角色配音',
    capabilities: { isLegacy: false, supportCloning: true, isStreaming: true }
  },
  'sensevoice-v1': {
    id: 'sensevoice-v1',
    name: '通义语音识别',
    category: 'audio-stt',
    provider: 'dashscope',
    description: '高精度语音转文字',
    capabilities: { isLegacy: false }
  }
};

/**
 * 获取指定分类的活跃模型列表
 */
export const getActiveModels = (category?: ModelCategory) => {
  return Object.values(MODEL_REGISTRY).filter(m => {
    const matchCategory = category ? m.category === category : true;
    return matchCategory && !m.capabilities.isLegacy;
  });
};

/**
 * 检查模型是否支持参考图
 */
export const supportsReference = (modelId: string) => {
  return MODEL_REGISTRY[modelId]?.capabilities.supportRefImage ?? false;
};

/**
 * 检查模型是否支持多模态消息
 */
export const isMultiModalModel = (modelId: string) => {
  return MODEL_REGISTRY[modelId]?.capabilities.isMultiModal ?? false;
};
