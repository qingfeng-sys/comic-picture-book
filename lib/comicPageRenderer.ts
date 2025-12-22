/**
 * 将绘本页面渲染为 Canvas（包含：背景图 + 对话气泡 + 旁白）
 * 说明：
 * - 这是客户端工具（依赖 DOM / Image / Canvas），用于“下载导出”场景。
 * - 与 `components/ComicPageCanvas/ComicPageCanvas.tsx` 的绘制逻辑保持一致，但导出默认使用原图尺寸以保证清晰度。
 */

import type { ComicPage, DialogueItem } from '@/types';

export async function renderComicPageToCanvas(
  page: ComicPage,
  options?: { maxWidth?: number }
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取Canvas上下文');

  const img = await loadImage(page.imageUrl);

  const maxWidth = options?.maxWidth;
  const scale = maxWidth ? Math.min(maxWidth / img.width, 1) : 1;
  const canvasWidth = Math.round(img.width * scale);
  const canvasHeight = Math.round(img.height * scale);

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // 背景图
  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

  // 对话气泡
  if (page.dialogue && page.dialogue.length > 0) {
    const first = page.dialogue[0];
    const isNewFormat =
      typeof first === 'object' &&
      first !== null &&
      'anchor' in first &&
      'x_ratio' in first &&
      'y_ratio' in first;

    if (isNewFormat) {
      const dialogues = page.dialogue.filter(
        (d): d is DialogueItem =>
          typeof d === 'object' && d !== null && 'anchor' in d && 'x_ratio' in d && 'y_ratio' in d
      );
      drawDialogueBubblesNew(ctx, canvasWidth, canvasHeight, dialogues);
    } else {
      const dialogues = page.dialogue.filter((d): d is string => typeof d === 'string');
      drawDialogueBubblesOld(ctx, canvasWidth, canvasHeight, dialogues);
    }
  }

  // 旁白
  if (page.narration) {
    drawNarration(ctx, canvasWidth, canvasHeight, page.narration);
  }

  return canvas;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
    img.src = src;
  });
}

function drawDialogueBubblesNew(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  dialogues: DialogueItem[]
) {
  if (dialogues.length === 0) return;

  const bubblePadding = 18;
  const bubbleMargin = 20;
  const borderRadius = 20;
  const borderWidth = 2.5;
  const fontSize = Math.max(16, canvasWidth / 45);
  const lineHeight = fontSize * 1.4;
  const maxBubbleWidth = Math.min(canvasWidth * 0.42, 300);

  ctx.font = `${Math.round(fontSize)}px "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimHei", "Arial", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  dialogues.forEach((dialogue) => {
    // 导出时同样带上角色名，避免“说话人错配/难辨”的观感问题
    const text = `${dialogue.role}：${dialogue.text}`;
    const lines = wrapText(ctx, text, maxBubbleWidth - bubblePadding * 2);

    const textHeight = lines.length * lineHeight;
    const bubbleHeight = textHeight + bubblePadding * 2;
    const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    const bubbleWidth = Math.min(maxBubbleWidth, maxLineWidth + bubblePadding * 2);

    const targetX = Math.min(Math.max(dialogue.x_ratio, 0), 1) * canvasWidth;
    const targetY = Math.min(Math.max(dialogue.y_ratio, 0), 1) * canvasHeight;

    let bubbleX: number;
    const floatOffset = bubbleHeight * 0.6;
    let bubbleY = targetY - bubbleHeight - floatOffset;

    if (dialogue.anchor === 'left') bubbleX = targetX - bubbleWidth;
    else if (dialogue.anchor === 'right') bubbleX = targetX;
    else bubbleX = targetX - bubbleWidth / 2;

    bubbleX = Math.max(bubbleMargin, Math.min(canvasWidth - bubbleWidth - bubbleMargin, bubbleX));
    bubbleY = Math.max(bubbleMargin, Math.min(canvasHeight - bubbleHeight - bubbleMargin - 80, bubbleY));

    // 避脸：气泡遮挡头部点时尝试换位（侧边/下方）
    const adjusted = adjustBubbleToAvoidHead(
      { bubbleX, bubbleY, bubbleWidth, bubbleHeight },
      { targetX, targetY },
      { canvasWidth, canvasHeight, bubbleMargin }
    );
    bubbleX = adjusted.bubbleX;
    bubbleY = adjusted.bubbleY;

    // 气泡
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = borderWidth;
    
    // 添加气泡阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, borderRadius);
    ctx.fill();
    
    // 重置阴影再画边框
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();

    // 文本
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    const textX = bubbleX + bubbleWidth / 2;
    const textY = bubbleY + bubblePadding + textHeight / 2;
    lines.forEach((line, idx) => {
      const lineY = textY - ((lines.length - 1) * lineHeight) / 2 + idx * lineHeight;
      ctx.fillText(line, textX, lineY);
    });

    // 尾巴
    const tailBaseX = Math.min(Math.max(targetX, bubbleX + 15), bubbleX + bubbleWidth - 15);
    const isLeft = targetX < bubbleX + bubbleWidth / 2;
    const tailY = bubbleY < targetY ? bubbleY + bubbleHeight * 0.9 : bubbleY + bubbleHeight * 0.1;
    drawSpeechTail(ctx, tailBaseX, tailY, isLeft, borderWidth);

    ctx.textAlign = 'left';
  });
}

function adjustBubbleToAvoidHead(
  bubble: { bubbleX: number; bubbleY: number; bubbleWidth: number; bubbleHeight: number },
  head: { targetX: number; targetY: number },
  canvas: { canvasWidth: number; canvasHeight: number; bubbleMargin: number }
) {
  const headRadius = Math.max(28, canvas.canvasWidth / 26);
  const maxY = canvas.canvasHeight - bubble.bubbleHeight - canvas.bubbleMargin - 80;

  const intersects = (x: number, y: number) =>
    circleIntersectsRect(head.targetX, head.targetY, headRadius, x, y, bubble.bubbleWidth, bubble.bubbleHeight);

  if (!intersects(bubble.bubbleX, bubble.bubbleY)) return bubble;

  const candidates: Array<{ x: number; y: number }> = [];
  candidates.push({ x: bubble.bubbleX, y: head.targetY - bubble.bubbleHeight - headRadius * 1.2 });
  candidates.push({ x: head.targetX - bubble.bubbleWidth - canvas.bubbleMargin, y: head.targetY - bubble.bubbleHeight / 2 });
  candidates.push({ x: head.targetX + canvas.bubbleMargin, y: head.targetY - bubble.bubbleHeight / 2 });
  candidates.push({ x: bubble.bubbleX, y: head.targetY + headRadius * 0.6 });

  for (const c of candidates) {
    const x = Math.max(canvas.bubbleMargin, Math.min(canvas.canvasWidth - bubble.bubbleWidth - canvas.bubbleMargin, c.x));
    const y = Math.max(canvas.bubbleMargin, Math.min(maxY, c.y));
    if (!intersects(x, y)) return { ...bubble, bubbleX: x, bubbleY: y };
  }

  return bubble;
}

function circleIntersectsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}

function drawDialogueBubblesOld(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  dialogues: string[]
) {
  if (dialogues.length === 0) return;

  const bubblePadding = 18;
  const bubbleMargin = 20;
  const borderRadius = 20;
  const borderWidth = 2.5;
  const fontSize = Math.max(16, canvasWidth / 45);
  const lineHeight = fontSize * 1.4;
  const maxBubbleWidth = Math.min(canvasWidth * 0.42, 300);

  ctx.font = `${Math.round(fontSize)}px "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimHei", "Arial", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  dialogues.forEach((dialogue, idx) => {
    const text = dialogue;

    ctx.textAlign = 'left';
    const lines = wrapText(ctx, text, maxBubbleWidth - bubblePadding * 2);
    ctx.textAlign = 'center';

    const textHeight = lines.length * lineHeight;
    const bubbleHeight = textHeight + bubblePadding * 2;
    const maxLineWidth = Math.max(
      ...lines.map(line => {
        ctx.textAlign = 'left';
        const width = ctx.measureText(line).width;
        ctx.textAlign = 'center';
        return width;
      })
    );
    const bubbleWidth = Math.min(maxBubbleWidth, maxLineWidth + bubblePadding * 2);

    const isRight = idx % 2 === 0;
    const bubbleX = isRight ? canvasWidth - bubbleWidth - bubbleMargin : bubbleMargin;
    let bubbleY = (canvasHeight / (dialogues.length + 1)) * (idx + 1) - bubbleHeight / 2;
    bubbleY = Math.max(bubbleMargin, Math.min(canvasHeight - bubbleHeight - bubbleMargin - 80, bubbleY));

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = borderWidth;
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 10;

    drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, borderRadius);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    const textX = bubbleX + bubbleWidth / 2;
    const textY = bubbleY + bubblePadding + textHeight / 2;
    lines.forEach((line, lineIndex) => {
      const lineY = textY - ((lines.length - 1) * lineHeight) / 2 + lineIndex * lineHeight;
      ctx.fillText(line, textX, lineY);
    });
  });
}

function drawNarration(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  narration: string
) {
  if (!narration || narration.trim().length === 0) return;

  const padding = 14;
  const margin = 20;
  const borderRadius = 12;
  const fontSize = Math.max(13, canvasWidth / 55);
  const lineHeight = fontSize * 1.4;
  const maxWidth = canvasWidth * 0.75;

  ctx.font = `${Math.round(fontSize)}px "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimHei", "Arial", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const lines = wrapText(ctx, narration, maxWidth - padding * 2);
  const textHeight = lines.length * lineHeight;
  const bubbleHeight = textHeight + padding * 2;
  const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
  const bubbleWidth = Math.min(maxWidth, maxLineWidth + padding * 2);

  const bubbleX = (canvasWidth - bubbleWidth) / 2;
  const bubbleY = canvasHeight - bubbleHeight - margin;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // 深色半透明
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // 浅色边框
  ctx.lineWidth = 1;

  drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, borderRadius);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF'; // 白色文字
  ctx.textAlign = 'center';
  const textX = bubbleX + bubbleWidth / 2;
  const textY = bubbleY + padding + textHeight / 2;

  lines.forEach((line, lineIndex) => {
    const lineY = textY - ((lines.length - 1) * lineHeight) / 2 + lineIndex * lineHeight;
    ctx.fillText(line, textX, lineY);
  });

  ctx.textAlign = 'left';
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
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
}

function drawSpeechTail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isLeft: boolean,
  borderWidth: number = 2
) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = borderWidth;

  ctx.beginPath();
  if (isLeft) {
    ctx.moveTo(x, y);
    ctx.lineTo(x - 10, y + 10);
    ctx.lineTo(x + 6, y + 10);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + 10, y + 10);
    ctx.lineTo(x - 6, y + 10);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const words = text.split('');
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine + word;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);
  return lines.length > 0 ? lines : [text];
}


