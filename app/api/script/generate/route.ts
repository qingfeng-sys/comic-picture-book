import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateScriptWithDeepSeek, generateStoryboardWithDeepSeek, continueConversation, DeepSeekMessage } from '@/lib/deepseek';
import { StoryboardData } from '@/types';
import { validationError, maskServerError } from '@/lib/apiAuth';
import { withApiProtection } from '@/lib/security/withApiProtection';

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

    // 支持两种输出格式：storyboard（结构化分镜）或 script（传统文本脚本）
    // 为兼容旧版前端，默认仍返回 script；前端若需要分镜，请传 outputFormat: 'storyboard'
    const format = outputFormat || 'script';

    if (format === 'storyboard') {
      // 生成结构化分镜数据
      let storyboardData: StoryboardData;
      
      if (conversationHistory && conversationHistory.length > 0) {
        // 继续对话模式（暂时不支持，使用首次生成）
        const history: DeepSeekMessage[] = conversationHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));
        // 注意：继续对话模式暂时使用首次生成逻辑
        storyboardData = await generateStoryboardWithDeepSeek(prompt, history);
      } else {
        // 首次生成
        storyboardData = await generateStoryboardWithDeepSeek(prompt);
      }

      return NextResponse.json({
        success: true,
        data: {
          storyboard: storyboardData,
        },
      });
    } else {
      // 传统文本脚本格式（保持向后兼容）
      let script: string;
      
      if (conversationHistory && conversationHistory.length > 0) {
        // 继续对话
        const history: DeepSeekMessage[] = conversationHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        }));
        script = await continueConversation(prompt, history);
      } else {
        // 首次生成
        script = await generateScriptWithDeepSeek(prompt);
      }

      return NextResponse.json({
        success: true,
        data: {
          script,
        },
      });
    }
  } catch (error: any) {
    return maskServerError('脚本生成失败，请稍后重试', request, error);
  }
}

export const POST = withApiProtection(postHandler, { requireApiKey: true });

