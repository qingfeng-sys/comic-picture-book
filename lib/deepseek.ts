import { StoryboardData } from '@/types';
import { dashscopeChat, type DashScopeMessage, type DashScopeChatOptions } from '@/lib/dashscope';

type Provider = 'dashscope' | 'fallback';

export interface ChatResult {
  content: string;
  provider: Provider;
  model?: string;
}

export interface PipelineProviders {
  outline?: string;
  script?: string;
  storyboard?: string;
}

export interface StoryOutline {
  overview: {
    title: string;
    logline: string;
    theme?: string;
    tone?: string;
    target_audience?: string;
    page_count_suggestion?: number;
  };
  chapters: Array<{
    chapter_id: number;
    title: string;
    summary: string;
    key_scenes?: string[];
  }>;
  characters: Array<{
    name: string;
    role: string;
    description: string;
    visual?: string;
  }>;
}

function buildFallbackStoryboard(): StoryboardData {
  return {
    frames: [
      {
        frame_id: 1,
        image_prompt: 'AI 当前繁忙，请稍后再试',
        dialogues: [],
        narration: 'AI 当前繁忙，请稍后再试',
      },
    ],
  };
}

function safeJsonSubstring(text: string): string | null {
  const cleaned = text.trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return cleaned.substring(firstBrace, lastBrace + 1);
  }
  return null;
}

function stripMarkdownFences(text: string): string {
  let t = text.trim();
  if (t.startsWith('```json')) t = t.replace(/^```json\s*/i, '');
  else if (t.startsWith('```')) t = t.replace(/^```\s*/i, '');
  if (t.endsWith('```')) t = t.replace(/\s*```\s*$/i, '');
  return t.trim();
}

function parseJsonOrThrow<T>(raw: string): T {
  const t = stripMarkdownFences(raw);
  const sub = safeJsonSubstring(t) || t;
  return JSON.parse(sub) as T;
}

function validateOutline(o: any): StoryOutline {
  if (!o || typeof o !== 'object') throw new Error('大纲必须是JSON对象');
  if (!o.overview || typeof o.overview !== 'object') throw new Error('大纲必须包含overview对象');
  if (!o.overview.title || !o.overview.logline) throw new Error('overview必须包含title与logline');
  if (!Array.isArray(o.chapters) || o.chapters.length === 0) throw new Error('大纲必须包含chapters数组且不能为空');
  if (!Array.isArray(o.characters) || o.characters.length === 0) throw new Error('大纲必须包含characters数组且不能为空');
  return o as StoryOutline;
}

function validateStoryboard(storyboardData: any): StoryboardData {
  if (!storyboardData || typeof storyboardData !== 'object') {
    throw new Error('返回数据必须是JSON对象');
  }
  if (!storyboardData.frames || !Array.isArray(storyboardData.frames)) {
    throw new Error('返回数据必须包含frames数组字段');
  }
  if (storyboardData.frames.length === 0) {
    throw new Error('frames数组不能为空');
  }
  storyboardData.frames.forEach((frame: any, index: number) => {
    if (!frame.frame_id || typeof frame.frame_id !== 'number') {
      throw new Error(`第${index + 1}个分镜缺少frame_id或格式错误`);
    }
    if (!frame.image_prompt || typeof frame.image_prompt !== 'string') {
      throw new Error(`第${index + 1}个分镜缺少image_prompt或格式错误`);
    }
    if (!Array.isArray(frame.dialogues)) {
      throw new Error(`第${index + 1}个分镜的dialogues必须是数组`);
    }
    frame.dialogues.forEach((dialogue: any, dIndex: number) => {
      if (!dialogue.role || typeof dialogue.role !== 'string') {
        throw new Error(`第${index + 1}个分镜的第${dIndex + 1}个对话缺少role字段`);
      }
      if (!dialogue.text || typeof dialogue.text !== 'string') {
        throw new Error(`第${index + 1}个分镜的第${dIndex + 1}个对话缺少text字段`);
      }
      if (!['left', 'right', 'center'].includes(dialogue.anchor)) {
        throw new Error(`第${index + 1}个分镜的第${dIndex + 1}个对话的anchor必须是"left"、"right"或"center"`);
      }
      // 宽容处理：坐标非法时自动夹紧，减少整段失败导致 fallback
      if (typeof dialogue.x_ratio !== 'number' || Number.isNaN(dialogue.x_ratio)) {
        dialogue.x_ratio = 0.5;
      }
      if (typeof dialogue.y_ratio !== 'number' || Number.isNaN(dialogue.y_ratio)) {
        dialogue.y_ratio = 0.4;
      }
      dialogue.x_ratio = Math.min(1, Math.max(0, dialogue.x_ratio));
      dialogue.y_ratio = Math.min(1, Math.max(0, dialogue.y_ratio));

      // 宽容处理：anchor 与 x_ratio 不一致时自动纠正（避免“说话人位置”与气泡朝向错配）
      const recommended =
        dialogue.x_ratio < 0.45 ? 'left' : dialogue.x_ratio > 0.55 ? 'right' : 'center';
      if (dialogue.anchor !== recommended) {
        dialogue.anchor = recommended;
      }
    });
  });
  return storyboardData as StoryboardData;
}

export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ModelCandidate {
  model: string;
  options?: DashScopeChatOptions;
}

async function callWithModelFallback(
  stage: 'outline' | 'script' | 'storyboard' | 'chat',
  candidates: ModelCandidate[],
  messages: DashScopeMessage[],
  baseOptions: DashScopeChatOptions
): Promise<ChatResult> {
  let lastErr: any;
  for (const c of candidates) {
    try {
      const result = await dashscopeChat(c.model, messages, { ...baseOptions, ...(c.options || {}) });
      return { content: result.content, provider: 'dashscope', model: c.model };
    } catch (err: any) {
      lastErr = err;
      console.error(`[DashScope][${stage}] 模型调用失败，尝试回退:`, c.model, err?.message || err);
    }
  }
  console.error(`[DashScope][${stage}] 所有模型均失败:`, lastErr?.message || lastErr);
  return { content: 'AI 当前繁忙，请稍后再试', provider: 'fallback' };
}

function toDashScopeMessages(messages: DeepSeekMessage[]): DashScopeMessage[] {
  return messages.map(m => ({ role: m.role, content: m.content }));
}

function stageTimeoutMs(stage: 'outline' | 'script' | 'storyboard' | 'chat'): number {
  // 为大模型/长输出设置更合理的默认超时，仍可用环境变量覆盖
  const envKey =
    stage === 'outline'
      ? 'DASHSCOPE_OUTLINE_TIMEOUT_MS'
      : stage === 'script'
        ? 'DASHSCOPE_SCRIPT_TIMEOUT_MS'
        : stage === 'storyboard'
          ? 'DASHSCOPE_STORYBOARD_TIMEOUT_MS'
          : 'DASHSCOPE_CHAT_TIMEOUT_MS';
  const raw = (process.env as any)[envKey];
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;

  // defaults
  if (stage === 'outline') return 45_000;
  if (stage === 'script') return 90_000;
  if (stage === 'storyboard') return 120_000;
  return 60_000;
}

/**
 * 1) 故事大纲：优先 qwen-flash（enable_thinking=false），失败回退到 qwen3-30b-a3b-instruct-2507、deepseek-r1-distill-qwen-14b
 * 输出：严格 JSON
 */
export async function generateStoryOutline(
  userPrompt: string,
  conversationHistory: DeepSeekMessage[] = []
): Promise<{ outline: StoryOutline; providers: PipelineProviders }> {
  const systemPrompt = `你是一个专业的故事大纲策划师。请根据用户的故事描述，生成“绘本/漫画”创作所需的大纲。

**严格规则：**
1) 只输出 JSON 对象；不要任何解释、说明、markdown 代码块标记
2) JSON 必须严格符合下方 Schema（字段名必须一致）

Schema:
{
  "overview": {
    "title": "故事标题",
    "logline": "一句话梗概",
    "theme": "主题(可选)",
    "tone": "风格/氛围(可选)",
    "target_audience": "目标读者(可选)",
    "page_count_suggestion": 10
  },
  "chapters": [
    {
      "chapter_id": 1,
      "title": "章节标题",
      "summary": "章节概述(2-4句)",
      "key_scenes": ["关键场景1","关键场景2"]
    }
  ],
  "characters": [
    {
      "name": "角色名",
      "role": "主角/配角/反派/旁白等",
      "description": "性格与动机(1-3句)",
      "visual": "外观要点(可选，便于画面统一)"
    }
  ]
}

现在开始，只输出 JSON。`;

  const messages: DashScopeMessage[] = [
    { role: 'system', content: systemPrompt },
    ...toDashScopeMessages(conversationHistory),
    { role: 'user', content: userPrompt },
  ];

  const candidates: ModelCandidate[] = [
    { model: 'qwen-flash', options: { enable_thinking: false } },
    { model: 'qwen3-30b-a3b-instruct-2507' },
    { model: 'deepseek-r1-distill-qwen-14b' },
  ];

  const result = await callWithModelFallback('outline', candidates, messages, {
    temperature: 0.4,
    max_tokens: 2200,
    requestTimeoutMs: stageTimeoutMs('outline'),
  });
  if (result.provider === 'fallback') {
    throw new Error('大纲生成失败');
  }

  const outline = validateOutline(parseJsonOrThrow(result.content));
  return { outline, providers: { outline: result.model } };
}

/**
 * 2) 故事脚本：使用大纲作为输入，输出“半结构化剧本格式”（非 JSON）
 * 优先 deepseek-v3.2（DashScope），失败回退 deepseek-r1-distill-qwen-32b、deepseek-r1-distill-qwen-14b
 */
export async function generateStoryScriptFromOutline(
  outline: StoryOutline,
  conversationHistory: DeepSeekMessage[] = []
): Promise<{ script: string; providers: PipelineProviders }> {
  const systemPrompt = `你是一个专业的绘本/漫画编剧。请基于“故事大纲 JSON”写出一个适合绘本/漫画分镜的**半结构化剧本**。

**输出要求：**
- 不要输出 JSON
- 每一页用如下格式（示例）：
【第1页】
场景：...
画面：...
人物：...
对白：
- 角色A：...
- 角色B：...
旁白：...

**约束：**
- 总页数建议 8-12 页
- 对白简短、儿童友好（如目标读者是儿童）
- 场景描述要可视化、便于画面生成
`;

  const userContent = `这是故事大纲(JSON)：\n${JSON.stringify(outline, null, 2)}\n\n请按要求输出剧本。`;

  const messages: DashScopeMessage[] = [
    { role: 'system', content: systemPrompt },
    ...toDashScopeMessages(conversationHistory),
    { role: 'user', content: userContent },
  ];

  const candidates: ModelCandidate[] = [
    { model: 'qwen2.5-72b-instruct' },
    { model: 'deepseek-v3.2' },
    { model: 'deepseek-r1-distill-qwen-32b' },
    { model: 'deepseek-r1-distill-qwen-14b' },
  ];

  const result = await callWithModelFallback('script', candidates, messages, {
    temperature: 0.8,
    max_tokens: 3200,
    requestTimeoutMs: stageTimeoutMs('script'),
  });

  if (result.provider === 'fallback') {
    throw new Error('脚本生成失败');
  }

  return { script: result.content.trim(), providers: { script: result.model } };
}

/**
 * 调用DeepSeek API生成脚本
 */
export async function generateScriptWithDeepSeek(
  userPrompt: string,
  conversationHistory: DeepSeekMessage[] = []
): Promise<ChatResult> {
  // 兼容旧调用：这里按新流程生成“剧本”（大纲→剧本），并返回 content（非 JSON）
  const { outline } = await generateStoryOutline(userPrompt, conversationHistory);
  const { script, providers } = await generateStoryScriptFromOutline(outline, conversationHistory);
  return { content: script, provider: 'dashscope', model: providers.script };
}

interface StoryboardResult {
  storyboard: StoryboardData;
  provider: Provider;
  providers?: PipelineProviders;
}

/**
 * 生成结构化分镜数据（JSON格式），返回提供方标记
 */
export async function generateStoryboardWithDeepSeek(
  userPrompt: string,
  conversationHistory: DeepSeekMessage[] = []
): Promise<StoryboardResult> {
  // 新流程：大纲(JSON) → 半结构化剧本 → 分镜(JSON)
  try {
    const { outline, providers: p1 } = await generateStoryOutline(userPrompt, conversationHistory);
    const { script, providers: p2 } = await generateStoryScriptFromOutline(outline, conversationHistory);

    // 系统提示词：强制输出纯JSON，不允许任何自然语言
    const systemPrompt = `你是一个JSON数据生成器。你的任务是根据用户提供的“故事剧本”，生成结构化的漫画分镜JSON数据。

**严格规则：**
1. 只输出JSON对象，不要包含任何解释、说明、markdown代码块标记或其他文字
2. 不要输出markdown代码块标记（如三个反引号）
3. 不要输出任何自然语言说明
4. 直接输出JSON对象，格式必须完全符合以下Schema
5. **严禁对白错配**：dialogues 中每条对话的 role 必须是真正说话者，text 必须是该角色说的话；不要把 A 的话写到 B 的 role 下
6. **坐标必须对应说话者头部**：x_ratio/y_ratio 代表该 role 角色的头部位置；不要随意填数

**输出格式（必须是这个结构）：**
{
  "frames": [
    {
      "frame_id": 1,
      "image_prompt": "场景描述，用于生成图片",
      "dialogues": [
        {
          "role": "角色名",
          "text": "这句话真的会显示在气泡里",
          "anchor": "left",
          "x_ratio": 0.25,
          "y_ratio": 0.35
        }
      ],
      "narration": "只允许旁白"
    }
  ]
}

**字段说明：**
- frames: 分镜帧数组
- frame_id: 分镜帧编号，从1开始递增
- image_prompt: 图片生成提示词，描述场景、角色、动作，要具体生动
- dialogues: 对话数组，每个对话包含：
  - role: 说话角色名称
  - text: 对话内容（这句话会直接显示在气泡里，不要包含角色名）
  - anchor: 气泡对齐方式，"left"（左侧对齐）、"right"（右侧对齐）或"center"（居中）
  - x_ratio: 角色头部X坐标，0~1（0.0=最左侧，1.0=最右侧）
  - y_ratio: 角色头部Y坐标，0~1（0.0=最顶部，1.0=最底部）
- narration: 旁白文字（可选），只允许旁白，不要包含对话内容

**anchor规则：**
- 左侧角色（x_ratio < 0.5）通常用 "left"
- 右侧角色（x_ratio > 0.5）通常用 "right"
- 居中角色用 "center"

**坐标建议：**
- 左侧角色：x_ratio = 0.2~0.4, y_ratio = 0.3~0.5
- 右侧角色：x_ratio = 0.6~0.8, y_ratio = 0.3~0.5
- 居中角色：x_ratio = 0.4~0.6, y_ratio = 0.3~0.5

**示例输出（直接复制这个格式）：**
{
  "frames": [
    {
      "frame_id": 1,
      "image_prompt": "阳光明媚的早晨，小兔子站在花园里，周围是五颜六色的花朵",
      "dialogues": [
        {
          "role": "小兔子",
          "text": "今天天气真好，我要去探险！",
          "anchor": "left",
          "x_ratio": 0.3,
          "y_ratio": 0.4
        }
      ],
      "narration": "小兔子决定去森林探险"
    }
  ]
}

现在开始，只输出JSON对象，不要任何其他内容。`;

    const messages: DashScopeMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `这是故事剧本（半结构化文本）：\n${script}\n\n请按要求生成分镜JSON。` },
    ];

    const candidates: ModelCandidate[] = [
      { model: 'qwen3-next-80b-a3b-instruct' },
      { model: 'qwen2.5-72b-instruct' },
      { model: 'qwen3-max' },
    ];

    const result = await callWithModelFallback('storyboard', candidates, messages, {
      temperature: 0.7,
      max_tokens: 4200,
      requestTimeoutMs: stageTimeoutMs('storyboard'),
    });

    if (result.provider === 'fallback') {
      return { storyboard: buildFallbackStoryboard(), provider: 'fallback', providers: { ...p1, ...p2 } };
    }

    const storyboardData = validateStoryboard(parseJsonOrThrow(result.content));
    return {
      storyboard: storyboardData,
      provider: 'dashscope',
      providers: { ...p1, ...p2, storyboard: result.model },
    };
  } catch (error: any) {
    console.error('分镜生成失败:', error?.message || error);
    return { storyboard: buildFallbackStoryboard(), provider: 'fallback' };
  }
}

/**
 * 继续对话，完善脚本
 * 在对话模式下，系统提示词会稍微调整，更注重修改和完善
 */
export async function continueConversation(
  userMessage: string,
  conversationHistory: DeepSeekMessage[]
): Promise<ChatResult> {
  // 在对话模式下，使用更灵活的提示词
  const systemPrompt = `你是一个专业的故事脚本创作助手。用户正在完善一个漫画绘本脚本。

请根据用户的反馈和要求，修改和完善脚本。保持脚本的格式（每页以"第X页："开头），确保内容适合制作成漫画绘本。`;

  const messages: DashScopeMessage[] = [
    { role: 'system', content: systemPrompt },
    ...toDashScopeMessages(conversationHistory),
    { role: 'user', content: userMessage },
  ];

  const candidates: ModelCandidate[] = [
    { model: 'qwen2.5-72b-instruct' },
    { model: 'deepseek-v3.2' },
    { model: 'deepseek-r1-distill-qwen-32b' },
    { model: 'deepseek-r1-distill-qwen-14b' },
  ];

  const result = await callWithModelFallback('chat', candidates, messages, {
    temperature: 0.8,
    max_tokens: 2600,
    requestTimeoutMs: stageTimeoutMs('chat'),
  });
  return result;
}

