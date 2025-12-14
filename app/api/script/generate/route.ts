import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  generateStoryScript,
  generateStoryboard,
  continueStoryConversation,
  type StoryMessage,
  generateOutline,
  generateScriptFromOutline,
} from '@/lib/storyGenerator';
import { StoryboardData } from '@/types';
import { validationError, maskServerError } from '@/lib/apiAuth';
import { withApiProtection } from '@/lib/security/withApiProtection';
import { logger } from '@/lib/logger';

async function postHandler(request: NextRequest) {
  try {
    const schema = z.object({
      prompt: z.string().min(1),
      conversationHistory: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant', 'system']),
            content: z.string(),
          })
        )
        .optional(),
      outputFormat: z.enum(['script', 'storyboard']).optional(),
      // 可选：仅生成大纲（调试/扩展用），前端暂不使用
      stage: z.enum(['outline', 'script', 'storyboard']).optional(),
    });

    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return validationError();
    }

    const { prompt, conversationHistory, outputFormat } = parseResult.data;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { success: false, error: '请提供有效的提示词' },
        { status: 400 }
      );
    }

    // 兼容旧版：仍支持 outputFormat=script|storyboard
    // 新版逻辑：大纲(JSON) → 半结构化剧本 → 分镜(JSON)
    const format = outputFormat || 'script';
    const requestedStage = parseResult.data.stage;

    // 对话续写：如果带 conversationHistory 且 format=script，沿用 continueConversation（更贴近“修改/续写”）
    const hasHistory = (conversationHistory || []).length > 0;
    if (hasHistory && format === 'script' && !requestedStage) {
      const result = await continueStoryConversation(prompt, conversationHistory || []);
      logger.info(
        {
          provider: result.provider,
          model: result.model,
          mode: 'chat_script',
        },
        'script_generate_provider'
      );
      return NextResponse.json({
        success: true,
        data: {
          script: result.content,
          provider: result.model || result.provider,
        },
      });
    }

    // 支持 stage 精确控制（未来可开放给前端）
    if (requestedStage === 'outline') {
      const outlineResult = await generateOutline(prompt, conversationHistory || []);
      logger.info(
        {
          provider: 'dashscope',
          model: outlineResult.providers.outline,
          mode: 'outline',
        },
        'script_generate_provider'
      );
      return NextResponse.json({
        success: true,
        data: {
          outline: outlineResult.outline,
          provider: outlineResult.providers.outline || 'dashscope',
        },
      });
    }

    if (requestedStage === 'script') {
      const outlineResult = await generateOutline(prompt, conversationHistory || []);
      const scriptResult = await generateScriptFromOutline(outlineResult.outline, conversationHistory || []);
      return NextResponse.json({
        success: true,
        data: {
          outline: outlineResult.outline,
          script: scriptResult.script,
          provider: scriptResult.providers.script || 'dashscope',
          providers: { ...outlineResult.providers, ...scriptResult.providers },
        },
      });
    }

    if (format === 'storyboard' || requestedStage === 'storyboard') {
      // 生成结构化分镜数据（内部包含：大纲→剧本→分镜）
      const storyboardResult = await generateStoryboard(prompt, conversationHistory || []);

      logger.info(
        {
          provider: storyboardResult.provider,
          mode: 'storyboard',
          providers: storyboardResult.providers,
        },
        'script_generate_provider'
      );

      return NextResponse.json({
        success: true,
        data: {
          storyboard: storyboardResult.storyboard,
          provider: storyboardResult.providers?.storyboard || storyboardResult.provider,
          providers: storyboardResult.providers,
        },
      });
    } else {
      // 文本脚本（内部包含：大纲→剧本）
      const result = await generateStoryScript(prompt, conversationHistory as StoryMessage[] | undefined);

      logger.info(
        {
          provider: result.provider,
          model: result.model,
          mode: 'script',
        },
        'script_generate_provider'
      );
      
      return NextResponse.json({
        success: true,
        data: {
          script: result.content,
          provider: result.model || result.provider,
        },
      });
    }
  } catch (error: any) {
    return maskServerError('脚本生成失败，请稍后重试', request, error);
  }
}

export const POST = withApiProtection(postHandler, { requireApiKey: true });

