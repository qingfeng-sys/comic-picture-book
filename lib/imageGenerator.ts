/**
 * 图像生成工具
 * 支持通义万相（异步）与七牛云文生图
 */

import { generateImageWithQiniu } from '@/lib/providers/qiniu/image';
import { generateImageWithWan, isWanGenerationModel } from '@/lib/providers/dashscope/image';
import { StoryboardData, DialogueItem, GenerationModel, QINIU_GENERATION_MODELS, WAN_GENERATION_MODELS } from '@/types';

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

/**
 * 生成绘本页面图像
 * 使用七牛云文生图API（kling-v1模型）
 */
export async function generateComicPageImage(
  pageText: string,
  pageNumber: number,
  retryCount: number = 0,
  generationModel: GenerationModel = DEFAULT_MODEL,
  characterReference?: string
): Promise<string> {
  const prompt = generateImagePrompt(pageText, pageNumber);
  const maxRetries = 2; // 最多重试2次
  const modelToUse = normalizeGenerationModel(generationModel);
  const negativePrompt = '恐怖，暴力，成人内容，低质量，模糊，变形';
  
  try {
    console.log(`正在生成第${pageNumber}页图像，提示词: ${prompt}`);
    
    const imageUrl = isWanGenerationModel(modelToUse)
      ? await generateImageWithWan(prompt, {
        model: modelToUse,
        negative_prompt: negativePrompt,
        size: '1024*1024',
      })
      : await generateImageWithQiniu(
        prompt,
        {
          negative_prompt: negativePrompt,
          aspect_ratio: '1:1',
          human_fidelity: 0.8,
          model: modelToUse,
          // 七牛支持 image_reference（用于角色一致性/图生图参考）
          image_reference: characterReference,
        }
      );
    
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
      return generateComicPageImage(pageText, pageNumber, retryCount + 1, modelToUse);
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
  characterReferences?: Record<string, string>
): Promise<Array<{ pageNumber: number; imageUrl: string; text: string; dialogue?: DialogueItem[]; narration?: string }>> {
  const comicPages = [];
  
  for (let i = 0; i < storyboardData.frames.length; i++) {
    const frame = storyboardData.frames[i];
    const pageNumber = startPageNumber + i;
    
    // 在第一张图片前添加短暂延迟，避免API并发问题
    if (i === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 增加到1秒，确保API就绪
    }
    
    try {
      const primaryRole = frame.dialogues?.[0]?.role;
      const refUrl = primaryRole && characterReferences ? (characterReferences[primaryRole] || characterReferences[primaryRole.trim()]) : undefined;
      // 使用frame的image_prompt生成图片
      const imageUrl = await generateComicPageImage(frame.image_prompt, pageNumber, 0, generationModel, refUrl);
      
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

/**
 * 批量生成绘本页面（旧方法，从文本提取）
 */
export async function generateComicPages(
  scriptSegment: string,
  startPageNumber: number = 1,
  generationModel: GenerationModel = DEFAULT_MODEL,
  characterReferences?: Record<string, string>
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

    // 文本模式下：取第一条对话的角色名（“角色：...”）尝试匹配参考图
    const firstDialogue = dialogue[0] || '';
    const roleMatch = firstDialogue.match(/^([^：:]+)[：:]/);
    const role = roleMatch?.[1]?.trim();
    const refUrl = role && characterReferences ? (characterReferences[role] || characterReferences[role.trim()]) : undefined;

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

