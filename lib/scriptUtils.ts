import { Script, ScriptSegment, ScriptWithSegments, StoryboardData, ComicBook } from '@/types';

const PAGES_PER_SEGMENT = 10;

/**
 * 从脚本内容中提取分镜数据（如果存在）
 */
export function extractStoryboardFromScript(content: string): StoryboardData | null {
  try {
    // 查找分镜数据标记
    const storyboardMarker = '=== 分镜数据（JSON）===';
    const markerIndex = content.indexOf(storyboardMarker);
    
    if (markerIndex === -1) {
      return null;
    }
    
    // 提取JSON部分
    const jsonStart = markerIndex + storyboardMarker.length;
    const jsonText = content.substring(jsonStart).trim();
    
    // 解析JSON
    const storyboardData = JSON.parse(jsonText);
    
    // 验证数据结构
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
 * 估算脚本页数（基于内容长度和结构）
 */
export function estimatePageCount(script: string): number {
  // 首先检查是否有分镜数据
  const storyboardData = extractStoryboardFromScript(script);
  if (storyboardData && storyboardData.frames && storyboardData.frames.length > 0) {
    return storyboardData.frames.length;
  }
  
  // 简单估算：每页约200-300字，或根据"第X页"或"第X帧"标记
  const pageMarkers = script.match(/第\d+[页帧][：:]/g);
  if (pageMarkers) {
    return pageMarkers.length;
  }
  
  // 如果没有明确标记，按字数估算
  const wordCount = script.length;
  const estimatedPages = Math.ceil(wordCount / 250);
  return Math.max(1, estimatedPages);
}

/**
 * 切分脚本为多个片段（每段最多10页）
 */
export function splitScriptIntoSegments(script: string): ScriptSegment[] {
  const segments: ScriptSegment[] = [];
  
  // 首先检查是否有分镜数据
  const storyboardData = extractStoryboardFromScript(script);
  
  if (storyboardData && storyboardData.frames && storyboardData.frames.length > 0) {
    // 如果有分镜数据，按frames切分
    const totalFrames = storyboardData.frames.length;
    let segmentId = 1;
    
    for (let i = 0; i < totalFrames; i += PAGES_PER_SEGMENT) {
      const segmentFrames = storyboardData.frames.slice(i, i + PAGES_PER_SEGMENT);
      const pageCount = segmentFrames.length;
      
      // 为这个segment生成文本内容（用于显示）
      const segmentText = segmentFrames.map(frame => {
        let text = `第${frame.frame_id}帧：\n`;
        text += `[场景：${frame.image_prompt}]\n`;
        if (frame.dialogues && frame.dialogues.length > 0) {
          frame.dialogues.forEach(dialogue => {
            text += `${dialogue.role}："${dialogue.text}"\n`;
          });
        }
        if (frame.narration) {
          text += `旁白：${frame.narration}\n`;
        }
        return text;
      }).join('\n\n');
      
      segments.push({
        segmentId,
        content: segmentText, // 保留文本用于显示，但实际生成时会使用storyboard数据
        pageCount,
      });
      segmentId++;
    }
    
    return segments;
  }
  
  // 尝试按"第X页"或"第X帧"标记切分
  const pagePattern = /(第\d+[页帧][：:][\s\S]*?)(?=第\d+[页帧][：:]|$)/g;
  const matches = [...script.matchAll(pagePattern)];
  
  if (matches.length > 0) {
    // 有明确页标记的情况
    let currentSegment: string[] = [];
    let currentPageCount = 0;
    let segmentId = 1;
    
    for (const match of matches) {
      const pageContent = match[1].trim();
      currentSegment.push(pageContent);
      currentPageCount++;
      
      if (currentPageCount >= PAGES_PER_SEGMENT) {
        segments.push({
          segmentId,
          content: currentSegment.join('\n\n'),
          pageCount: currentPageCount,
        });
        currentSegment = [];
        currentPageCount = 0;
        segmentId++;
      }
    }
    
    // 处理剩余内容
    if (currentSegment.length > 0) {
      segments.push({
        segmentId,
        content: currentSegment.join('\n\n'),
        pageCount: currentPageCount,
      });
    }
  } else {
    // 没有明确页标记，按段落和字数切分
    const paragraphs = script.split(/\n\n+/).filter(p => p.trim());
    const wordsPerPage = 250;
    const totalWords = script.length;
    const totalPages = Math.ceil(totalWords / wordsPerPage);
    const totalSegments = Math.ceil(totalPages / PAGES_PER_SEGMENT);
    
    const wordsPerSegment = Math.ceil(totalWords / totalSegments);
    
    let currentSegment: string[] = [];
    let currentWordCount = 0;
    let segmentId = 1;
    
    for (const paragraph of paragraphs) {
      currentSegment.push(paragraph);
      currentWordCount += paragraph.length;
      
      if (currentWordCount >= wordsPerSegment && currentSegment.length > 0) {
        const pageCount = Math.ceil(currentWordCount / wordsPerPage);
        segments.push({
          segmentId,
          content: currentSegment.join('\n\n'),
          pageCount: Math.min(pageCount, PAGES_PER_SEGMENT),
        });
        currentSegment = [];
        currentWordCount = 0;
        segmentId++;
      }
    }
    
    // 处理剩余内容
    if (currentSegment.length > 0) {
      const pageCount = Math.ceil(currentWordCount / wordsPerPage);
      segments.push({
        segmentId,
        content: currentSegment.join('\n\n'),
        pageCount: Math.min(pageCount, PAGES_PER_SEGMENT),
      });
    }
  }
  
  // 确保至少有一个片段
  if (segments.length === 0) {
    segments.push({
      segmentId: 1,
      content: script,
      pageCount: estimatePageCount(script),
    });
  }
  
  return segments;
}

/**
 * 创建带切分的脚本对象
 */
export function createScriptWithSegments(
  title: string,
  content: string
): ScriptWithSegments {
  const segments = splitScriptIntoSegments(content);
  const now = new Date().toISOString();
  const id = `script_${Date.now()}`;
  
  return {
    id,
    title,
    content,
    createdAt: now,
    updatedAt: now,
    segments,
    totalSegments: segments.length,
  };
}

/**
 * 从本地存储加载脚本
 */
export function loadScriptsFromStorage(): Script[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem('comic_scripts');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('加载脚本失败:', error);
    return [];
  }
}

/**
 * 保存脚本到本地存储
 */
export function saveScriptToStorage(script: Script): void {
  if (typeof window === 'undefined') return;
  
  try {
    const scripts = loadScriptsFromStorage();
    const existingIndex = scripts.findIndex(s => s.id === script.id);
    
    if (existingIndex >= 0) {
      scripts[existingIndex] = script;
    } else {
      scripts.push(script);
    }
    
    localStorage.setItem('comic_scripts', JSON.stringify(scripts));
  } catch (error) {
    console.error('保存脚本失败:', error);
  }
}

/**
 * 从文本导入脚本
 */
export function importScriptFromText(text: string, title?: string): Script {
  const now = new Date().toISOString();
  const id = `script_${Date.now()}`;
  
  return {
    id,
    title: title || `导入的脚本_${new Date().toLocaleDateString()}`,
    content: text,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 从本地存储加载所有绘本
 */
export function loadComicBooksFromStorage(): ComicBook[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem('comic_books');
    if (!stored) return [];
    const comicBooks: ComicBook[] = JSON.parse(stored);
    // 兼容旧数据：如果绘本没有title字段，尝试从脚本获取或使用默认值
    return comicBooks.map(book => {
      if (!book.title) {
        // 尝试从脚本获取标题（需要加载脚本）
        const scripts = loadScriptsFromStorage();
        const script = scripts.find(s => s.id === book.scriptId);
        return {
          ...book,
          title: script?.title || `绘本 ${book.id.substring(0, 8)}`,
        };
      }
      return book;
    });
  } catch (error) {
    console.error('加载绘本失败:', error);
    return [];
  }
}

/**
 * 保存绘本到本地存储（支持新增和更新）
 */
export function saveComicBookToStorage(comicBook: ComicBook): void {
  if (typeof window === 'undefined') return;
  
  try {
    const comicBooks = loadComicBooksFromStorage();
    const existingIndex = comicBooks.findIndex(cb => cb.id === comicBook.id);
    
    if (existingIndex >= 0) {
      // 更新已有绘本
      comicBooks[existingIndex] = comicBook;
    } else {
      // 新增绘本
      comicBooks.push(comicBook);
    }
    
    localStorage.setItem('comic_books', JSON.stringify(comicBooks));
  } catch (error) {
    console.error('保存绘本失败:', error);
  }
}

/**
 * 从本地存储删除绘本
 */
export function deleteComicBookFromStorage(comicBookId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const comicBooks = loadComicBooksFromStorage();
    const filtered = comicBooks.filter(cb => cb.id !== comicBookId);
    localStorage.setItem('comic_books', JSON.stringify(filtered));
  } catch (error) {
    console.error('删除绘本失败:', error);
  }
}

