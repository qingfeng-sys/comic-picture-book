import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateComicPages, generateComicPagesFromStoryboard } from '@/lib/imageGenerator';
import { saveImageToStorage } from '@/lib/imageStorage';
import { StoryboardData, DialogueItem, GenerationModel } from '@/types';
import { validationError, maskServerError } from '@/lib/apiAuth';
import { withApiProtection } from '@/lib/security/withApiProtection';

async function postHandler(request: NextRequest) {
  try {
    const dialogueSchema: z.ZodType<DialogueItem> = z.object({
      role: z.string(),
      text: z.string(),
      anchor: z.enum(['left', 'right', 'center']),
      x_ratio: z.number().min(0).max(1),
      y_ratio: z.number().min(0).max(1),
    });
    const storyboardSchema: z.ZodType<StoryboardData> = z.object({
      frames: z.array(
        z.object({
          frame_id: z.number(),
          image_prompt: z.string(),
          dialogues: z.array(dialogueSchema),
          narration: z.string().optional(),
        })
      ),
    });
    const schema = z.object({
      scriptSegment: z.string().optional(),
      storyboard: storyboardSchema.optional(),
      startPageNumber: z.number().int().positive().optional(),
      scriptId: z.string().optional(),
      segmentId: z.number().int().optional(),
      model: z.string().optional(),
    });

    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return validationError();
    }

    const { scriptSegment, storyboard, startPageNumber, scriptId, segmentId, model } = parseResult.data;
    const generationModel = (model as GenerationModel | undefined) || undefined;

    let pages;
    
    // 优先使用storyboard数据（新格式）
    if (storyboard && typeof storyboard === 'object' && storyboard.frames) {
      console.log('使用分镜数据生成绘本，共', storyboard.frames.length, '帧');
      pages = generationModel
        ? await generateComicPagesFromStoryboard(
          storyboard as StoryboardData,
          startPageNumber || 1,
          generationModel
        )
        : await generateComicPagesFromStoryboard(
          storyboard as StoryboardData,
          startPageNumber || 1
        );
    } else if (scriptSegment && typeof scriptSegment === 'string') {
      // 兼容旧格式：从文本提取
      console.log('使用文本脚本生成绘本');
      pages = generationModel
        ? await generateComicPages(
          scriptSegment,
          startPageNumber || 1,
          generationModel
        )
        : await generateComicPages(
          scriptSegment,
          startPageNumber || 1
        );
    } else {
      return NextResponse.json(
        { success: false, error: '请提供有效的脚本片段或分镜数据' },
        { status: 400 }
      );
    }

    // 自动保存所有生成的图片到本地存储
    if (pages && pages.length > 0) {
      console.log('开始保存生成的图片，共', pages.length, '张');
      const savedPages = await Promise.all(
        pages.map(async (page, index) => {
          try {
            const saved = await saveImageToStorage(
              page.imageUrl,
              page.pageNumber,
              scriptId || 'unknown',
              segmentId || 0
            );
            return {
              ...page,
              imageUrl: saved.url, // 使用本地URL替换原始URL
            };
          } catch (error) {
            console.error(`保存第${page.pageNumber}页图片失败:`, error);
            // 如果保存失败，保留原始URL
            return page;
          }
        })
      );
      pages = savedPages;
      console.log('图片保存完成');
    }

    return NextResponse.json({
      success: true,
      data: {
        pages,
      },
    });
  } catch (error: any) {
    return maskServerError('绘本生成服务暂时不可用，请稍后再试', request, error);
  }
}

export const POST = withApiProtection(postHandler, { requireApiKey: true });

