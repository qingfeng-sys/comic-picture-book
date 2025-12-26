import { MODEL_REGISTRY } from '@/lib/config/models';

// 脚本相关类型
export interface Script {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptSegment {
  segmentId: number;
  content: string;
  pageCount: number;
}

export interface ScriptWithSegments extends Script {
  segments: ScriptSegment[];
  totalSegments: number;
}

// 动态推导模型数组和类型
export const ALL_MODELS = Object.values(MODEL_REGISTRY);

export const IMAGE_GENERATION_MODELS = ALL_MODELS
  .filter(m => m.category === 'image')
  .map(m => m.id);

export const WAN_GENERATION_MODELS = ALL_MODELS
  .filter(m => m.category === 'image' && m.provider === 'dashscope')
  .map(m => m.id);

export const QINIU_GENERATION_MODELS = ALL_MODELS
  .filter(m => m.category === 'image' && m.provider === 'qiniu')
  .map(m => m.id);

export type GenerationModel = (typeof IMAGE_GENERATION_MODELS)[number];

// 对话消息类型
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// 绘本相关类型
export interface ComicPage {
  pageNumber: number;
  imageUrl: string;
  text: string;
  dialogue?: (string | DialogueItem)[]; // 对话内容数组（支持旧格式string[]和新格式DialogueItem[]）
  narration?: string; // 旁白/场景描述
}

export interface ComicBook {
  id: string;
  scriptId: string;
  segmentId: number;
  title: string; // 绘本标题（默认与脚本标题一致，可重命名）
  pages: ComicPage[];
  createdAt: string;
  updatedAt?: string; // 更新时间（用于重命名时记录）
}

// 分镜相关类型
export interface DialogueItem {
  role: string;
  text: string;
  anchor: 'left' | 'right' | 'center'; // 气泡对齐方式
  x_ratio: number; // 0~1 相对坐标X（角色头部位置）
  y_ratio: number; // 0~1 相对坐标Y（角色头部位置）
}

export interface StoryboardFrame {
  frame_id: number;
  image_prompt: string;
  dialogues: DialogueItem[];
  narration?: string; // 旁白，只允许旁白文字
}

export interface StoryboardData {
  frames: StoryboardFrame[];
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 角色库（用于跨帧一致性：角色参考图/立绘）
export interface CharacterProfile {
  id: string;
  name: string; // 角色名（用于和分镜 dialogues.role 匹配）
  role?: string; // 角色定位：主角、配角等
  description?: string; // 性格/身份/关系等
  visual?: string; // 外观要点（服装/发型/配色等）
  matchNames?: string[]; // 可选：用于匹配 dialogues.role 的别名列表
  referenceImageUrl?: string; // 角色立绘/参考图（建议为同源URL，如 /comic-assets/...）
  /**
   * 角色来源：用于在“角色库”按脚本分组展示
   * - script：由某个脚本自动/批量生成
   * - custom：用户在角色库手动新增
   */
  sourceType?: 'script' | 'custom';
  sourceScriptId?: string;
  sourceScriptTitle?: string;
  createdAt: string;
  updatedAt: string;
}

