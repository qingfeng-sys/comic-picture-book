/**
 * 图像生成工具
 * 支持通义万相（异步）与七牛云文生图
 */

import { generateImageWithQiniu } from '@/lib/providers/qiniu/image';
import { generateImageWithWan, isWanGenerationModel } from '@/lib/providers/dashscope/image';
import { generateImageWithVolcanoArk, isVolcanoArkModel } from '@/lib/providers/volcanoark/image';
import { StoryboardData, DialogueItem, GenerationModel, QINIU_GENERATION_MODELS, WAN_GENERATION_MODELS } from '@/types';
import { MODEL_REGISTRY } from '@/lib/config/models';

export interface ImageGenerationOptions {
  prompt: string;
  style?: 'cartoon' | 'realistic' | 'anime';
  size?: '256x256' | '512x512' | '1024x1024';
}

const DEFAULT_MODEL: GenerationModel = 'gemini-2.5-flash-image';

function normalizeGenerationModel(model?: GenerationModel | string): GenerationModel {
  const wanModels = WAN_GENERATION_MODELS as readonly string[];
  const qiniuModels = QINIU_GENERATION_MODELS as readonly string[];

  if (model && (wanModels.includes(model as string) || qiniuModels.includes(model as string))) {
    return model as GenerationModel;
  }

  return DEFAULT_MODEL;
}

/**
 * 为脚本页面生成图像提示词
 * 优化为适合绘本生成的中文提示词
 */
export function generateImagePrompt(pageText: string, pageNumber: number): string {
  // 提取关键场景描述
  const sceneDescription = extractSceneDescription(pageText);
  
  // 使用简洁的中文提示词，更适合七牛云API
  // 限制总长度，避免API拒绝
  const basePrompt = `卡通风格绘本插图，第${pageNumber}页，${sceneDescription}`;
  const stylePrompt = '。风格：色彩鲜艳，温馨有趣，适合儿童，简洁构图，线条流畅，角色表情生动';
  
  // 确保总长度不超过500字符（API可能有限制）
  const fullPrompt = basePrompt + stylePrompt;
  if (fullPrompt.length > 500) {
    // 如果太长，缩短场景描述部分
    const maxSceneLength = 500 - stylePrompt.length - basePrompt.length + sceneDescription.length;
    const shortenedScene = sceneDescription.substring(0, Math.max(50, maxSceneLength));
    return `卡通风格绘本插图，第${pageNumber}页，${shortenedScene}${stylePrompt}`;
  }
  
  return fullPrompt;
}

/**
 * 从脚本文本中提取对话内容
 * 返回对话数组，每个元素是一个完整的对话（包含角色和内容）
 */
export function extractDialogue(pageText: string): string[] {
  const dialogues: string[] = [];
  const seenDialogues = new Set<string>(); // 避免重复
  
  // 匹配各种引号格式的对话：
  // 1. 角色："对话内容"（中文引号）
  // 2. 角色："对话内容"（英文引号）
  // 3. 角色："对话内容"（混合引号）
  const dialoguePatterns = [
    // 标准格式：角色："对话" 或 角色："对话"
    /([^："：\n\r]+?)[：:]\s*["""]([^"""]+?)["""]/g,
    // 无冒号格式：角色"对话"
    /([^："：\n\r]+?)\s*["""]([^"""]+?)["""]/g,
  ];
  
  for (const pattern of dialoguePatterns) {
    let match;
    // 重置正则表达式的 lastIndex
    pattern.lastIndex = 0;
    while ((match = pattern.exec(pageText)) !== null) {
      const character = match[1].trim();
      const dialogue = match[2].trim();
      
      // 过滤掉明显不是对话的内容
      if (dialogue && character && 
          !character.includes('场景') && 
          !character.includes('第') &&
          !character.includes('页') &&
          dialogue.length > 0) {
        const dialogueText = `${character}："${dialogue}"`;
        // 避免重复添加
        if (!seenDialogues.has(dialogueText)) {
          dialogues.push(dialogueText);
          seenDialogues.add(dialogueText);
        }
      }
    }
  }
  
  // 如果没有找到对话，尝试更宽松的模式（只匹配引号内容）
  if (dialogues.length === 0) {
    const loosePattern = /["""]([^"""]{2,})["""]/g;
    let match;
    while ((match = loosePattern.exec(pageText)) !== null) {
      const dialogue = match[1].trim();
      // 过滤掉场景描述等非对话内容
      if (dialogue && 
          !dialogue.includes('场景') && 
          !dialogue.includes('第') &&
          !dialogue.includes('页') &&
          dialogue.length >= 2) {
        const dialogueText = `"${dialogue}"`;
        if (!seenDialogues.has(dialogueText)) {
          dialogues.push(dialogueText);
          seenDialogues.add(dialogueText);
        }
      }
    }
  }
  
  return dialogues;
}

/**
 * 从脚本文本中提取旁白/场景描述
 */
export function extractNarration(pageText: string): string {
  let narration = pageText;
  
  // 1. 移除页号标记
  narration = narration.replace(/第\d+页[：:]/g, '');
  
  // 2. 提取场景描述（方括号内的内容）
  const sceneMatches = narration.match(/\[场景[：:](.*?)\]/g);
  if (sceneMatches && sceneMatches.length > 0) {
    const scenes = sceneMatches.map(m => 
      m.replace(/\[场景[：:]|\]/g, '').trim()
    ).filter(s => s.length > 0);
    
    if (scenes.length > 0) {
      narration = scenes.join('，');
      return narration;
    }
  }
  
  // 3. 移除所有对话（带引号的内容）
  narration = narration.replace(/[^："：\n]+[：:]["""][^"""]+["""]/g, '');
  narration = narration.replace(/["""][^"""]+["""]/g, '');
  
  // 4. 移除场景标记
  narration = narration.replace(/\[场景[：:].*?\]/g, '');
  narration = narration.replace(/\[.*?\]/g, '');
  
  // 5. 移除元数据标记
  narration = narration.replace(/\*\*.*?\*\*[：:].*?(\n|$)/g, '');
  
  // 6. 清理空白
  narration = narration
    .replace(/\n+/g, ' ')
    .replace(/\r+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 7. 如果为空，返回默认值
  if (!narration || narration.length < 3) {
    return '';
  }
  
  return narration;
}

/**
 * 从脚本文本中提取场景描述
 */
function extractSceneDescription(text: string): string {
  let description = text;
  
  // 1. 移除所有元数据部分（--- 分隔符后的所有内容）
  const parts = description.split('---');
  description = parts[0].trim();
  
  // 2. 移除所有元数据标记行（**故事主题**、**适合年龄**、**页数建议**等）
  // 使用更严格的模式，匹配整行
  description = description.replace(/\*\*故事主题\*\*[：:].*?(\n|$)/g, '');
  description = description.replace(/\*\*适合年龄\*\*[：:].*?(\n|$)/g, '');
  description = description.replace(/\*\*页数建议\*\*[：:].*?(\n|$)/g, '');
  description = description.replace(/\*\*.*?\*\*[：:].*?(\n|$)/g, ''); // 移除其他 **标记** 的内容
  
  // 3. 移除页号标记
  description = description.replace(/第\d+页[：:]/g, '');
  
  // 4. 提取场景描述（优先使用方括号内的场景描述）
  const sceneMatches = description.match(/\[场景[：:](.*?)\]/g);
  if (sceneMatches && sceneMatches.length > 0) {
    // 提取所有场景描述，移除方括号标记
    const scenes = sceneMatches.map(m => 
      m.replace(/\[场景[：:]|\]/g, '').trim()
    ).filter(s => s.length > 0);
    
    if (scenes.length > 0) {
      description = scenes.join('，');
    } else {
      // 如果没有有效场景，继续使用下面的逻辑
      description = description.replace(/\[场景[：:].*?\]/g, '');
    }
  }
  
  // 5. 如果没有明确的场景标记，提取主要内容
  if (!sceneMatches || sceneMatches.length === 0) {
    // 移除对话引号但保留角色和动作描述
    description = description
      .replace(/["""]/g, '') // 移除引号
    .replace(/[（(].*?[）)]/g, '') // 移除括号内容（通常是对话说明）
      .replace(/[：:][""]/g, '：') // 清理对话标记
      .replace(/[""]/g, ''); // 移除剩余引号
  }
  
  // 6. 移除所有剩余的方括号内容（如果还有）
  description = description.replace(/\[.*?\]/g, '');
  
  // 7. 移除多余的空行和空白
  description = description
    .replace(/\n+/g, ' ') // 换行符替换为空格
    .replace(/\r+/g, ' ') // 回车符替换为空格
    .replace(/\s+/g, ' ') // 多个空格合并为一个
    .trim();
  
  // 8. 如果文本太长，截取前150字（为风格描述留出空间）
  if (description.length > 150) {
    // 尝试在句号或逗号处截断，保持语义完整
    const truncated = description.substring(0, 150);
    const lastPunctuation = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('，'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？')
    );
    if (lastPunctuation > 100) {
      description = truncated.substring(0, lastPunctuation + 1);
    } else {
      description = truncated.trim();
    }
  }
  
  // 9. 最终清理：确保没有残留的元数据关键词
  if (description.includes('故事主题') || description.includes('适合年龄') || description.includes('页数建议')) {
    // 如果还有元数据残留，只取第一个句号之前的内容
    const firstSentence = description.split('。')[0];
    if (firstSentence.length > 20) {
      description = firstSentence;
    }
  }
  
  return description || '温馨的场景，角色互动';
}

import fs from 'fs/promises';
import path from 'path';

/**
 * 检查参考图是否为本地路径，如果是则转换为Base64
 */
async function checkAndConvertReferenceImage(
  url?: string | string[]
): Promise<string | string[] | undefined> {
  if (!url) return undefined;
  if (Array.isArray(url)) {
    const converted = await Promise.all(url.map((u) => checkAndConvertReferenceImage(u)));
    return converted.filter(Boolean) as string[];
  }

  // 如果已经是base64或http链接，直接返回
  if (url.startsWith('data:') || url.startsWith('http')) {
    return url;
  }

  // 检查是否为本地相对路径 (e.g. /comic-assets/xxx.png)
  if (url.startsWith('/')) {
    try {
      // 移除开头的斜杠，构建完整文件路径
      const relativePath = url.startsWith('/') ? url.slice(1) : url;
      const filePath = path.join(process.cwd(), 'public', relativePath);
      
      // 读取文件
      const fileBuffer = await fs.readFile(filePath);
      const base64 = fileBuffer.toString('base64');
      
      // 根据扩展名确定MIME类型
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 
                       ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                       'image/png';
                       
      console.log(`[参考图处理] 已将本地图片 ${url} 转换为 Base64`);
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.warn(`[参考图处理] 读取本地图片失败: ${url}`, error);
      // 读取失败时原样返回，让后续逻辑处理（可能会失败但保留原始错误）
      return url;
    }
  }

  return url;
}

/**
 * 生成绘本页面图像
 * 使用各引擎文生图API
 */
export async function generateComicPageImage(
  pageText: string,
  pageNumber: number,
  retryCount: number = 0,
  generationModel: GenerationModel = DEFAULT_MODEL,
  characterReference?: string | string[]
): Promise<string> {
  const prompt = generateImagePrompt(pageText, pageNumber);
  const maxRetries = 2; // 最多重试2次
  const modelToUse = normalizeGenerationModel(generationModel);
  // 加强“避免头像特写/半张脸/裁切”的负面约束
  const negativePrompt =
    '恐怖，暴力，成人内容，低质量，模糊，变形，头像特写，证件照，半张脸，裁切脸部，裁切人物，只有头部，近景特写，极端近距离';
  
  // 处理参考图：如果是本地路径，转换为Base64
  const processedReference = await checkAndConvertReferenceImage(characterReference);
  
  // 避免把整段 base64/dataURL 打到终端（会刷屏）
  const describeRef = (r: string) => {
    const kind = r.startsWith('http') ? 'url' : r.startsWith('data:') ? 'dataurl' : r.startsWith('/') ? 'local' : 'other';
    return { kind, len: r.length, head: r.slice(0, 18) };
  };
  const logRefChange = () => {
    if (!characterReference || !processedReference) return;
    if (typeof characterReference === 'string' && typeof processedReference === 'string') {
      if (processedReference !== characterReference) {
        console.log(`[生成第${pageNumber}页] 参考图已转换`, {
          from: describeRef(characterReference),
          to: describeRef(processedReference),
        });
      }
      return;
    }
    if (Array.isArray(characterReference) && Array.isArray(processedReference)) {
      const changed =
        characterReference.length !== processedReference.length ||
        characterReference.some((v, i) => processedReference[i] !== v);
      if (changed) {
        console.log(`[生成第${pageNumber}页] 参考图数组已转换`, {
          count: processedReference.length,
          from: characterReference.slice(0, 5).map(describeRef),
          to: processedReference.slice(0, 5).map(describeRef),
        });
      }
    }
  };
  logRefChange();
  
  try {
    const finalPrompt = prompt;

    console.log(`正在生成第${pageNumber}页图像，提示词: ${finalPrompt}`);
    
    let imageUrl: string;

    if (isWanGenerationModel(modelToUse)) {
      imageUrl = await generateImageWithWan(finalPrompt, {
        model: modelToUse,
        negative_prompt: negativePrompt,
        size: '1024*1024',
        // 参考图：
        // - wan2.5-i2i-preview：作为 i2i，需要底图（images）
        // - wan2.6-image：支持 1-3 张参考图立绘
        image_reference: (modelToUse === 'wan2.5-i2i-preview' || modelToUse === 'wan2.6-image') ? (processedReference as any) : undefined,
      });
    } else if (isVolcanoArkModel(modelToUse)) {
      const config = MODEL_REGISTRY[modelToUse];
      imageUrl = await generateImageWithVolcanoArk(finalPrompt, {
        model: modelToUse,
        size: config?.defaultParameters?.size || '2048x2048',
        watermark: config?.defaultParameters?.watermark ?? false,
        image_reference: processedReference,
      });
    } else {
      imageUrl = await generateImageWithQiniu(
        finalPrompt,
        {
          negative_prompt: negativePrompt,
          aspect_ratio: '1:1',
          human_fidelity: 0.8,
          model: modelToUse,
          // 七牛支持 image_reference（用于角色一致性/图生图参考）
          image_reference: processedReference as any,
        }
      );
    }
    
    // 验证返回的URL是否有效（不是占位符）
    if (imageUrl && !imageUrl.includes('via.placeholder.com') && !imageUrl.includes('placeholder')) {
      console.log(`第${pageNumber}页图像生成成功: ${imageUrl.substring(0, 100)}...`);
      return imageUrl;
    } else {
      throw new Error('API返回了无效的图片URL');
    }
  } catch (error: any) {
    console.error(`第${pageNumber}页图像生成失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error.message || error);
    
    // 如果还有重试次数，等待一段时间后重试
    if (retryCount < maxRetries) {
      const waitTime = (retryCount + 1) * 2000; // 递增等待时间：2秒、4秒
      console.log(`等待 ${waitTime}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // 保持参考图参数不丢失（i2i 模型必须有 images）
      return generateComicPageImage(pageText, pageNumber, retryCount + 1, modelToUse, characterReference);
    }
    
    // 所有重试都失败，抛出错误而不是返回占位符
    // 让调用方决定如何处理
    throw new Error(`第${pageNumber}页图像生成失败，已重试${maxRetries}次: ${error.message || '未知错误'}`);
  }
}

/**
 * 从分镜数据生成绘本页面（新方法，直接使用结构化数据）
 */
export async function generateComicPagesFromStoryboard(
  storyboardData: StoryboardData,
  startPageNumber: number = 1,
  generationModel: GenerationModel = DEFAULT_MODEL,
  characterReferences?: Record<string, string>,
  referenceImage?: string,
  referenceImages?: string[]
): Promise<Array<{ pageNumber: number; imageUrl: string; text: string; dialogue?: DialogueItem[]; narration?: string }>> {
  const comicPages = [];

  // 稳定气泡与说话人位置：根据全局统计推断每个角色的“常驻侧”（左/右/中），
  // 并对单帧内坐标明显错配（如两人坐标互换）做自动纠正。
  const normalizedStoryboard = normalizeStoryboardDialoguePositions(storyboardData);
  
  const normalizeRoleKey = (raw?: string): string | undefined => {
    if (!raw) return undefined;
    const s = String(raw).trim();
    if (!s) return undefined;
    // 去掉常见的后缀修饰：冒号、括号、方括号等
    const base = s.split(/[：:\(（\[【\{]/)[0]?.trim();
    return base || undefined;
  };

  for (let i = 0; i < normalizedStoryboard.frames.length; i++) {
    const frame = normalizedStoryboard.frames[i];
    const pageNumber = startPageNumber + i;
    
    // 在第一张图片前添加短暂延迟，避免API并发问题
    if (i === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 增加到1秒，确保API就绪
    }
    
    try {
      // 参考图选择策略：
      // - wan2.5-i2i-preview & wan2.6-image：支持多图多模态输入，优先使用“本帧出现的角色”立绘
      // - 其他模型：仅按角色名匹配单人立绘（字符串形式）
      let refUrl: string | string[] | undefined = undefined;
      const isMultiModalModel = generationModel === 'wan2.5-i2i-preview' || generationModel === 'wan2.6-image';

      if (isMultiModalModel) {
        // 多模态模型：只传“本帧出现的角色”的立绘，避免一次性塞太多图触发模型参数限制
        const perFrameRefs: string[] = [];
        const seen = new Set<string>();
        if (characterReferences && frame.dialogues && frame.dialogues.length > 0) {
          for (const d of frame.dialogues) {
            const key = normalizeRoleKey(d.role);
            if (!key) continue;
            const hit = characterReferences[key] || characterReferences[key.trim()];
            if (hit && !seen.has(hit)) {
              perFrameRefs.push(hit);
              seen.add(hit);
            }
          }
        }

        if (perFrameRefs.length > 0) {
          // 优先用“本帧角色命中”的参考图（通常 1~3 张）
          // wan2.6 支持 1-3 张，i2i 支持更多但此处限制在 5 张以内
          refUrl = perFrameRefs.slice(0, 5);
        } else {
          // 若本帧没法从角色名命中，再 fallback 到请求传入的 referenceImages / referenceImage
          const fromRequest =
            referenceImages && referenceImages.length > 0
              ? referenceImages
              : referenceImage
                ? [referenceImage]
                : [];
          refUrl = fromRequest.length > 0 ? fromRequest.slice(0, 5) : undefined;
        }
      }

      if (!refUrl && characterReferences && frame.dialogues && frame.dialogues.length > 0) {
        for (const d of frame.dialogues) {
          const key = normalizeRoleKey(d.role);
          if (!key) continue;
          const hit = characterReferences[key] || characterReferences[key.trim()];
          if (hit) {
            refUrl = hit;
            break;
          }
        }
      }
      // 使用frame的image_prompt生成图片
      // 关键：模型生成的“人物左右站位”经常与分镜坐标不一致，会造成“气泡贴错人”的观感。
      // 这里根据 dialogues 的 x_ratio 反向把“左右站位约束”写进图片提示词，尽量让画面与气泡坐标一致。
      const layoutHint = buildLayoutHintFromDialogues(frame.dialogues || []);
      const promptForImage = layoutHint ? `${frame.image_prompt}。构图要求：${layoutHint}` : frame.image_prompt;
      const imageUrl = await generateComicPageImage(promptForImage, pageNumber, 0, generationModel, refUrl);
      
      // 验证URL是否有效
      if (!imageUrl || imageUrl.includes('via.placeholder.com') || imageUrl.includes('placeholder')) {
        throw new Error('返回了无效的占位符URL');
      }
      
      // 直接使用frame中的dialogues和narration，不需要文本提取
      const dialogues: DialogueItem[] = frame.dialogues || [];
      
      comicPages.push({
        pageNumber,
        imageUrl,
        text: `第${frame.frame_id}帧：${frame.image_prompt}`, // 保留文本用于显示
        dialogue: dialogues.length > 0 ? dialogues : undefined,
        narration: frame.narration || undefined,
      });
      
      console.log(`✅ 第${pageNumber}页生成成功`);
      
      // 在每张图片生成后添加短暂延迟，避免API限流
      if (i < storyboardData.frames.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // 增加到1.5秒
      }
    } catch (error: any) {
      console.error(`❌ 生成第${pageNumber}页失败:`, error);
      // 如果第一张图片失败，抛出错误（因为这是关键页面）
      if (i === 0) {
        throw new Error(`第${pageNumber}页（第一页）图像生成失败，无法继续: ${error.message || '未知错误'}`);
      }
      // 其他页面失败时，记录错误但继续生成
      console.warn(`⚠️ 跳过第${pageNumber}页，继续生成其他页面`);
      // 可以选择添加一个错误标记的页面，或者直接跳过
    }
  }
  
  if (comicPages.length === 0) {
    throw new Error('所有页面生成失败，请检查API配置和网络连接');
  }
  
  return comicPages;
}

function buildLayoutHintFromDialogues(dialogues: DialogueItem[]): string {
  if (!dialogues || dialogues.length === 0) return '';
  // 取每个角色的平均 x_ratio / y_ratio，用“九宫格方位”描述站位（左上/中上/右上...）
  const roleToXs = new Map<string, number[]>();
  const roleToYs = new Map<string, number[]>();
  for (const d of dialogues) {
    const role = String(d.role || '').trim();
    if (!role) continue;
    const x = typeof d.x_ratio === 'number' && !Number.isNaN(d.x_ratio) ? d.x_ratio : 0.5;
    const y = typeof d.y_ratio === 'number' && !Number.isNaN(d.y_ratio) ? d.y_ratio : 0.4;
    if (!roleToXs.has(role)) roleToXs.set(role, []);
    roleToXs.get(role)!.push(Math.min(1, Math.max(0, x)));
    if (!roleToYs.has(role)) roleToYs.set(role, []);
    roleToYs.get(role)!.push(Math.min(1, Math.max(0, y)));
  }
  if (roleToXs.size === 0) return '';

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const xSide = (x: number) => (x < 0.45 ? '左' : x > 0.55 ? '右' : '中');
  const yBand = (y: number) => (y < 0.33 ? '上' : y > 0.66 ? '下' : '中');
  const posName = (x: number, y: number) => `画面${xSide(x)}${yBand(y)}方`;

  const parts: string[] = [];
  // 限制最多输出 4 个角色，避免提示词过长导致模型忽略
  const entries = Array.from(roleToXs.entries()).slice(0, 4);
  for (const [role, xs] of entries) {
    const ys = roleToYs.get(role) || [];
    const ax = avg(xs);
    const ay = ys.length > 0 ? avg(ys) : 0.4;
    parts.push(`${role}在${posName(ax, ay)}`);
  }
  // 强约束：避免角色换位/镜像；并要求严禁在画面中自带文字/气泡
  parts.push('保持人物站位，禁止左右镜像翻转或互换角色位置');
  parts.push('严禁在画面中绘制任何对白气泡、对话框、文字、标题或边框，保持纯净背景图，后期将由程序叠加文字');
  return parts.join('，');
}

function normalizeStoryboardDialoguePositions(storyboard: StoryboardData): StoryboardData {
  // 深拷贝（避免修改入参，尤其是复用到本地存储对象时）
  const cloned: StoryboardData = {
    frames: storyboard.frames.map((f) => ({
      ...f,
      dialogues: (f.dialogues || []).map((d) => ({ ...d })),
    })),
  };

  // 收集每个角色的 x_ratio 分布（用于推断“常驻侧”）
  const xsByRole = new Map<string, number[]>();
  for (const frame of cloned.frames) {
    for (const d of frame.dialogues || []) {
      const role = String(d.role || '').trim();
      if (!role) continue;
      const x = typeof d.x_ratio === 'number' && !Number.isNaN(d.x_ratio) ? d.x_ratio : 0.5;
      if (!xsByRole.has(role)) xsByRole.set(role, []);
      xsByRole.get(role)!.push(Math.min(1, Math.max(0, x)));
    }
  }

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0.5;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  };

  const roleMedianX = new Map<string, number>();
  for (const [role, xs] of xsByRole.entries()) {
    if (xs.length >= 2) roleMedianX.set(role, median(xs));
  }

  const recommendedAnchor = (x: number) => (x < 0.45 ? 'left' : x > 0.55 ? 'right' : 'center');

  // 逐帧纠正
  for (const frame of cloned.frames) {
    const ds = frame.dialogues || [];

    // 夹紧坐标 + anchor 与坐标对齐
    for (const d of ds) {
      d.x_ratio = Math.min(1, Math.max(0, typeof d.x_ratio === 'number' && !Number.isNaN(d.x_ratio) ? d.x_ratio : 0.5));
      d.y_ratio = Math.min(1, Math.max(0, typeof d.y_ratio === 'number' && !Number.isNaN(d.y_ratio) ? d.y_ratio : 0.4));
      d.anchor = recommendedAnchor(d.x_ratio);
    }

    // 常见错配：同一帧两人对话时，x/y 坐标互换（导致“说话人错配”的观感）
    if (ds.length === 2) {
      const a = ds[0];
      const b = ds[1];
      const roleA = String(a.role || '').trim();
      const roleB = String(b.role || '').trim();
      if (roleA && roleB && roleA !== roleB) {
        const mA = roleMedianX.get(roleA);
        const mB = roleMedianX.get(roleB);
        if (typeof mA === 'number' && typeof mB === 'number') {
          const distA = Math.abs(a.x_ratio - mA) + Math.abs(b.x_ratio - mB);
          const distSwapped = Math.abs(a.x_ratio - mB) + Math.abs(b.x_ratio - mA);
          // 如果交换坐标能显著更贴近各自角色的常驻侧，则交换坐标（不交换 role/text）
          if (distSwapped + 0.08 < distA) {
            const ax = a.x_ratio, ay = a.y_ratio;
            a.x_ratio = b.x_ratio; a.y_ratio = b.y_ratio;
            b.x_ratio = ax; b.y_ratio = ay;
            a.anchor = recommendedAnchor(a.x_ratio);
            b.anchor = recommendedAnchor(b.x_ratio);
          }
        }
      }
    }

    // 轻度纠正：如果某角色坐标极端偏离其常驻侧，则拉回到中位数附近（避免偶发翻边）
    for (const d of ds) {
      const role = String(d.role || '').trim();
      const m = roleMedianX.get(role);
      if (typeof m === 'number') {
        if (Math.abs(d.x_ratio - m) > 0.35) {
          d.x_ratio = m;
          d.anchor = recommendedAnchor(d.x_ratio);
        }
      }
    }
  }

  return cloned;
}

/**
 * 批量生成绘本页面（旧方法，从文本提取）
 */
export async function generateComicPages(
  scriptSegment: string,
  startPageNumber: number = 1,
  generationModel: GenerationModel = DEFAULT_MODEL,
  characterReferences?: Record<string, string>,
  referenceImage?: string,
  referenceImages?: string[]
): Promise<Array<{ pageNumber: number; imageUrl: string; text: string; dialogue?: string[]; narration?: string }>> {
  // 将脚本片段按页分割
  const pages = splitScriptIntoPages(scriptSegment);
  
  const comicPages = [];
  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i];
    const pageNumber = startPageNumber + i;
    
    // 提取对话和旁白
    const dialogue = extractDialogue(pageText);
    const narration = extractNarration(pageText);
    
    // 参考图选择策略：
    // - wan2.5-i2i-preview：优先使用 referenceImage（通常为拼图/底图）
    // - 其他模型：忽略 referenceImage，仅按角色名匹配单人立绘
    let refUrl: string | string[] | undefined =
      generationModel === 'wan2.5-i2i-preview'
        ? (referenceImages && referenceImages.length > 0 ? referenceImages : (referenceImage || undefined))
        : undefined;
    if (!refUrl && characterReferences && dialogue.length > 0) {
      for (const line of dialogue) {
        const roleMatch = line.match(/^([^：:（(\\[【]+)[：:]/);
        const role = roleMatch?.[1]?.trim();
        if (!role) continue;
        const hit = characterReferences[role] || characterReferences[role.trim()];
        if (hit) {
          refUrl = hit;
          break;
        }
      }
    }

    const imageUrl = await generateComicPageImage(pageText, pageNumber, 0, generationModel, refUrl);
    
    comicPages.push({
      pageNumber,
      imageUrl,
      text: pageText,
      dialogue: dialogue.length > 0 ? dialogue : undefined,
      narration: narration || undefined,
    });
  }
  
  return comicPages;
}

/**
 * 将脚本片段分割为单页内容
 */
function splitScriptIntoPages(scriptSegment: string): string[] {
  // 尝试按"第X页"标记分割
  const pagePattern = /(第\d+页[：:][\s\S]*?)(?=第\d+页[：:]|$)/g;
  const matches = [...scriptSegment.matchAll(pagePattern)];
  
  if (matches.length > 0) {
    return matches.map(m => m[1].trim());
  }
  
  // 如果没有明确标记，按段落分割（每2-3段为一页）
  const paragraphs = scriptSegment.split(/\n\n+/).filter(p => p.trim());
  const pages: string[] = [];
  
  for (let i = 0; i < paragraphs.length; i += 2) {
    const pageContent = paragraphs.slice(i, i + 2).join('\n\n');
    pages.push(pageContent);
  }
  
  return pages.length > 0 ? pages : [scriptSegment];
}

