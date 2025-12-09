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

// 文生图模型
export type GenerationModel = 'gemini-2.5-flash-image' | 'kling-v1';

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

