'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { ComicPage, DialogueItem } from '@/types';

interface ComicPageCanvasProps {
  page: ComicPage;
  className?: string;
}

export interface ComicPageCanvasRef {
  getCanvas: () => HTMLCanvasElement | null;
  download: (filename?: string) => void;
}

/**
 * 绘本页面Canvas组件
 * 在图片上叠加绘制对话气泡和旁白文字
 */
const ComicPageCanvas = forwardRef<ComicPageCanvasRef, ComicPageCanvasProps>(
  ({ page, className = '' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 创建图片对象
    const img = new Image();
    
    // 如果是base64 data URL，不需要设置crossOrigin
    if (!page.imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous'; // 处理跨域图片
    }

    img.onload = () => {
      try {
        // 设置canvas尺寸（保持图片原始比例，但限制最大宽度）
        const maxWidth = 800;
        const scale = Math.min(maxWidth / img.width, 1);
        const canvasWidth = img.width * scale;
        const canvasHeight = img.height * scale;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // 绘制背景图片
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        // 绘制对话气泡和文字（使用新的数据结构）
        if (page.dialogue && page.dialogue.length > 0) {
          // 检查是否是新的格式（DialogueItem数组）
          const firstDialogue = page.dialogue[0];
          const isNewFormat = typeof firstDialogue === 'object' && 
                              firstDialogue !== null &&
                              'anchor' in firstDialogue && 
                              'x_ratio' in firstDialogue && 
                              'y_ratio' in firstDialogue;
          
          if (isNewFormat) {
            // 新格式：使用anchor/x_ratio/y_ratio
            const dialogues = page.dialogue.filter((d): d is DialogueItem => 
              typeof d === 'object' && d !== null && 'anchor' in d && 'x_ratio' in d && 'y_ratio' in d
            );
            drawDialogueBubblesNew(ctx, canvasWidth, canvasHeight, dialogues);
          } else {
            // 兼容旧格式：字符串数组
            const dialogues = page.dialogue.filter((d): d is string => typeof d === 'string');
            drawDialogueBubbles(ctx, canvasWidth, canvasHeight, dialogues);
          }
        }
        
        // 绘制旁白（只在底部显示）
        if (page.narration) {
          drawNarration(ctx, canvasWidth, canvasHeight, page.narration);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('绘制Canvas失败:', err);
        setError('绘制失败');
        setIsLoading(false);
      }
    };

    img.onerror = () => {
      console.error('图片加载失败:', page.imageUrl);
      setError('图片加载失败');
      setIsLoading(false);
    };

    // 开始加载图片
    img.src = page.imageUrl;
  }, [page]);

  // 暴露canvas ref和方法
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    download: (filename?: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const defaultFilename = `page-${page.pageNumber}.png`;
      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || defaultFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 'image/png');
    },
  }));

  /**
   * 绘制对话气泡（新格式：使用anchor/x_ratio/y_ratio）
   */
  const drawDialogueBubblesNew = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    dialogues: DialogueItem[]
  ) => {
    if (dialogues.length === 0) return;

    const bubblePadding = 18;
    const bubbleMargin = 20;
    const borderRadius = 20;
    const borderWidth = 2.5;
    const fontSize = Math.max(16, canvasWidth / 45);
    const lineHeight = fontSize * 1.4;
    const maxBubbleWidth = Math.min(canvasWidth * 0.42, 300);

    // 设置字体
    ctx.font = `${Math.round(fontSize)}px "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimHei", "Arial", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; // 先设置为left用于计算宽度

    dialogues.forEach((dialogue) => {
      // 只使用text字段，不包含角色名
      const text = dialogue.text;

      // 计算文本换行
      const lines = wrapText(ctx, text, maxBubbleWidth - bubblePadding * 2);

      // 计算气泡尺寸
      const textHeight = lines.length * lineHeight;
      const bubbleHeight = textHeight + bubblePadding * 2;
      const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
      const bubbleWidth = Math.min(maxBubbleWidth, maxLineWidth + bubblePadding * 2);

      // 根据x_ratio和y_ratio计算角色头部位置
      const targetX = Math.min(Math.max(dialogue.x_ratio, 0), 1) * canvasWidth;
      const targetY = Math.min(Math.max(dialogue.y_ratio, 0), 1) * canvasHeight;

      // 根据anchor决定气泡位置
      let bubbleX: number;
      const floatOffset = bubbleHeight * 0.6; // 气泡在角色头顶上方的距离
      let bubbleY = targetY - bubbleHeight - floatOffset;

      if (dialogue.anchor === 'left') {
        // 左侧对齐：气泡右边缘对齐到角色位置
        bubbleX = targetX - bubbleWidth;
      } else if (dialogue.anchor === 'right') {
        // 右侧对齐：气泡左边缘对齐到角色位置
        bubbleX = targetX;
      } else {
        // center：气泡中心对齐到角色位置
        bubbleX = targetX - bubbleWidth / 2;
      }

      // 边缘避让：确保不超出画布
      bubbleX = Math.max(bubbleMargin, Math.min(canvasWidth - bubbleWidth - bubbleMargin, bubbleX));
      bubbleY = Math.max(bubbleMargin, Math.min(canvasHeight - bubbleHeight - bubbleMargin - 80, bubbleY)); // 底部留80px给旁白

      // 绘制气泡背景
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = borderWidth;

      drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, borderRadius);
      ctx.fill();
      ctx.stroke();

      // 绘制文本（居中显示）
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      const textX = bubbleX + bubbleWidth / 2;
      const textY = bubbleY + bubblePadding + textHeight / 2;

      lines.forEach((line, lineIndex) => {
        const lineY = textY - ((lines.length - 1) * lineHeight) / 2 + lineIndex * lineHeight;
        ctx.fillText(line, textX, lineY);
      });

      // 绘制尾巴指向角色
      const tailBaseX = Math.min(Math.max(targetX, bubbleX + 15), bubbleX + bubbleWidth - 15);
      const isLeft = targetX < bubbleX + bubbleWidth / 2;
      drawSpeechTail(ctx, tailBaseX, bubbleY + bubbleHeight * 0.9, isLeft, borderWidth);
      
      // 重置textAlign
      ctx.textAlign = 'left';
    });
  };

  /**
   * 绘制对话气泡（旧格式兼容）
   */
  const drawDialogueBubbles = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    dialogues: string[]
  ) => {
    if (dialogues.length === 0) return;

    const bubblePadding = 18;
    const bubbleMargin = 20;
    const borderRadius = 20; // 更大的圆角，更像椭圆
    const borderWidth = 2.5; // 稍粗的边框
    const fontSize = Math.max(16, canvasWidth / 45); // 稍大字体
    const lineHeight = fontSize * 1.4;
    const maxBubbleWidth = Math.min(canvasWidth * 0.42, 300); // 气泡最大宽度

    // 设置字体（使用系统字体，确保中文显示正常）
    ctx.font = `${Math.round(fontSize)}px "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimHei", "Arial", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // 将画布分为上中下区域，对话气泡分布在角色可能出现的区域（上半部分和中间部分）
    const topZoneHeight = canvasHeight * 0.35; // 顶部区域（角色头部区域）
    const middleZoneHeight = canvasHeight * 0.5; // 中间区域（角色身体区域）
    const bottomZoneHeight = canvasHeight * 0.15; // 底部区域（通常不放对话）

    // 旧格式：简单的字符串数组，按顺序分布
    dialogues.forEach((dialogue, idx) => {
      const text = dialogue;

      // 计算文本换行
      ctx.textAlign = 'left';
      const lines = wrapText(ctx, text, maxBubbleWidth - bubblePadding * 2);
      ctx.textAlign = 'center';

      // 计算气泡尺寸
      const textHeight = lines.length * lineHeight;
      const bubbleHeight = textHeight + bubblePadding * 2;
      const maxLineWidth = Math.max(...lines.map(line => {
        ctx.textAlign = 'left';
        const width = ctx.measureText(line).width;
        ctx.textAlign = 'center';
        return width;
      }));
      const bubbleWidth = Math.min(maxBubbleWidth, maxLineWidth + bubblePadding * 2);

      // 旧格式：简单的左右交替分布
      const isRight = idx % 2 === 0;
      let bubbleX = isRight
        ? canvasWidth - bubbleWidth - bubbleMargin
        : bubbleMargin;
      let bubbleY = (canvasHeight / (dialogues.length + 1)) * (idx + 1) - bubbleHeight / 2;
      bubbleY = Math.max(bubbleMargin, Math.min(canvasHeight - bubbleHeight - bubbleMargin - 80, bubbleY));

      // 绘制气泡
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = borderWidth;
      drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, borderRadius);
      ctx.fill();
      ctx.stroke();

      // 绘制文本
      ctx.fillStyle = '#000000';
      const textX = bubbleX + bubbleWidth / 2;
      const textY = bubbleY + bubblePadding + textHeight / 2;
      lines.forEach((line, lineIndex) => {
        const lineY = textY - ((lines.length - 1) * lineHeight) / 2 + lineIndex * lineHeight;
        ctx.fillText(line, textX, lineY);
      });
    });
  };

  /**
   * 绘制旁白（只在底部区域显示，半透明框）
   */
  const drawNarration = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    narration: string
  ) => {
    if (!narration || narration.trim().length === 0) return;

    const padding = 14;
    const margin = 20;
    const borderRadius = 12;
    const fontSize = Math.max(13, canvasWidth / 55);
    const lineHeight = fontSize * 1.4;
    const maxWidth = canvasWidth * 0.75; // 旁白宽度限制

    // 设置字体
    ctx.font = `${Math.round(fontSize)}px "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimHei", "Arial", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    // 计算文本换行
    const lines = wrapText(ctx, narration, maxWidth - padding * 2);

    // 计算气泡尺寸
    const textHeight = lines.length * lineHeight;
    const bubbleHeight = textHeight + padding * 2;
    const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    const bubbleWidth = Math.min(maxWidth, maxLineWidth + padding * 2);

    // 旁白固定在底部中央区域
    const bubbleX = (canvasWidth - bubbleWidth) / 2;
    const bubbleY = canvasHeight - bubbleHeight - margin; // 底部，留出margin空间

    // 绘制半透明背景（漫画风格的旁白框）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1.5;

    // 绘制圆角矩形
    drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, borderRadius);
    ctx.fill();
    ctx.stroke();

    // 绘制文本（居中显示）
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    const textX = bubbleX + bubbleWidth / 2;
    const textY = bubbleY + padding + textHeight / 2;

    lines.forEach((line, lineIndex) => {
      const lineY = textY - ((lines.length - 1) * lineHeight) / 2 + lineIndex * lineHeight;
      ctx.fillText(line, textX, lineY);
    });
    
    // 重置textAlign
    ctx.textAlign = 'left';
  };

  /**
   * 绘制圆角矩形
   */
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  /**
   * 绘制对话气泡的小尾巴（漫画风格，指向角色）
   */
  const drawSpeechTail = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isLeft: boolean,
    borderWidth: number = 2
  ) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = borderWidth;

    // 绘制更自然的三角形尾巴，指向角色方向
    ctx.beginPath();
    if (isLeft) {
      // 指向左侧（角色在左侧）
      ctx.moveTo(x, y);
      ctx.lineTo(x - 10, y + 10);
      ctx.lineTo(x + 6, y + 10);
    } else {
      // 指向右侧（角色在右侧）
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10, y + 10);
      ctx.lineTo(x - 6, y + 10);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  /**
   * 文本自动换行（支持中文）
   */
  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] => {
    const lines: string[] = [];
    const words = text.split('');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + word;
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [text];
  };

  if (error) {
    return (
      <div className={`border border-red-200 rounded-lg p-4 bg-red-50 ${className}`}>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">加载中...</p>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-auto rounded-lg"
        style={{ display: isLoading ? 'none' : 'block' }}
      />
    </div>
  );
});

ComicPageCanvas.displayName = 'ComicPageCanvas';

export default ComicPageCanvas;
