import { Script, ScriptSegment, ScriptWithSegments, StoryboardData, ComicBook } from '@/types';

const PAGES_PER_SEGMENT = 10;

/**
 * 从脚本内容中提取分镜数据（如果存在）
 */
export function extractStoryboardFromScript(content: string): StoryboardData | null {
  try {
    const storyboardMarker = '=== 分镜数据（JSON）===';
    const markerIndex = content.indexOf(storyboardMarker);
    if (markerIndex === -1) return null;
    const jsonStart = markerIndex + storyboardMarker.length;
    const jsonText = content.substring(jsonStart).trim();
    const storyboardData = JSON.parse(jsonText);
    if (storyboardData && typeof storyboardData === 'object' && storyboardData.frames && Array.isArray(storyboardData.frames)) {
      return storyboardData as StoryboardData;
    }
    return null;
  } catch (error) {
    console.warn('提取分镜数据失败:', error);
    return null;
  }
}

/**
 * 估算脚本页数
 */
export function estimatePageCount(script: string): number {
  const storyboardData = extractStoryboardFromScript(script);
  if (storyboardData && storyboardData.frames && storyboardData.frames.length > 0) {
    return storyboardData.frames.length;
  }
  const pageMarkers = script.match(/第\d+[页帧][：:]/g);
  if (pageMarkers) return pageMarkers.length;
  return Math.max(1, Math.ceil(script.length / 250));
}

/**
 * 切分脚本为多个片段
 */
export function splitScriptIntoSegments(script: string): ScriptSegment[] {
  const segments: ScriptSegment[] = [];
  const storyboardData = extractStoryboardFromScript(script);
  
  if (storyboardData && storyboardData.frames && storyboardData.frames.length > 0) {
    const totalFrames = storyboardData.frames.length;
    let segmentId = 1;
    for (let i = 0; i < totalFrames; i += PAGES_PER_SEGMENT) {
      const segmentFrames = storyboardData.frames.slice(i, i + PAGES_PER_SEGMENT);
      const segmentText = segmentFrames.map(frame => {
        let text = `第${frame.frame_id}帧：\n[场景：${frame.image_prompt}]\n`;
        frame.dialogues?.forEach(d => { text += `${d.role}："${d.text}"\n`; });
        if (frame.narration) text += `旁白：${frame.narration}\n`;
        return text;
      }).join('\n\n');
      segments.push({ segmentId, content: segmentText, pageCount: segmentFrames.length });
      segmentId++;
    }
    return segments;
  }
  
  const pagePattern = /(第\d+[页帧][：:][\s\S]*?)(?=第\d+[页帧][：:]|$)/g;
  const matches = [...script.matchAll(pagePattern)];
  if (matches.length > 0) {
    let currentSegment: string[] = [];
    let currentPageCount = 0;
    let segmentId = 1;
    for (const match of matches) {
      currentSegment.push(match[1].trim());
      currentPageCount++;
      if (currentPageCount >= PAGES_PER_SEGMENT) {
        segments.push({ segmentId, content: currentSegment.join('\n\n'), pageCount: currentPageCount });
        currentSegment = []; currentPageCount = 0; segmentId++;
      }
    }
    if (currentSegment.length > 0) {
      segments.push({ segmentId, content: currentSegment.join('\n\n'), pageCount: currentPageCount });
    }
  } else {
    segments.push({ segmentId: 1, content: script, pageCount: estimatePageCount(script) });
  }
  return segments;
}

/**
 * 创建带切分的脚本对象（用于 UI 状态管理）
 */
export function createScriptWithSegments(
  title: string,
  content: string,
  id?: string
): ScriptWithSegments {
  const segments = splitScriptIntoSegments(content);
  const now = new Date().toISOString();
  
  return {
    id: id || `script_${Date.now()}`,
    title,
    content,
    createdAt: now,
    updatedAt: now,
    segments,
    totalSegments: segments.length,
  };
}

/**
 * 从数据库加载脚本
 */
export async function loadScriptsFromStorage(): Promise<Script[]> {
  try {
    const resp = await fetch('/api/script');
    const result = await resp.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error('加载脚本失败:', error);
    return [];
  }
}

/**
 * 保存脚本到数据库
 */
export async function saveScriptToStorage(script: Partial<Script>): Promise<Script | null> {
  try {
    const resp = await fetch('/api/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(script),
    });
    const result = await resp.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('保存脚本失败:', error);
    return null;
  }
}

/**
 * 删除脚本
 */
export async function deleteScriptFromStorage(id: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/script?id=${id}`, { method: 'DELETE' });
    const result = await resp.json();
    return result.success;
  } catch (error) {
    console.error('删除脚本失败:', error);
    return false;
  }
}

/**
 * 从数据库加载所有绘本
 */
export async function loadComicBooksFromStorage(): Promise<ComicBook[]> {
  try {
    const resp = await fetch('/api/comic/book');
    const result = await resp.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error('加载绘本失败:', error);
    return [];
  }
}

/**
 * 保存绘本到数据库
 */
export async function saveComicBookToStorage(comicBook: any): Promise<ComicBook | null> {
  try {
    const resp = await fetch('/api/comic/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comicBook),
    });
    const result = await resp.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('保存绘本失败:', error);
    return null;
  }
}

/**
 * 从数据库删除绘本
 */
export async function deleteComicBookFromStorage(id: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/comic/book?id=${id}`, { method: 'DELETE' });
    const result = await resp.json();
    return result.success;
  } catch (error) {
    console.error('删除绘本失败:', error);
    return false;
  }
}

/**
 * 辅助方法：生成临时脚本（保留，但不建议用于持久化）
 */
export function importScriptFromText(text: string, title?: string): Script {
  const now = new Date().toISOString();
  return {
    id: `script_${Date.now()}`,
    title: title || `导入脚本_${new Date().toLocaleDateString()}`,
    content: text,
    createdAt: now,
    updatedAt: now,
  };
}
