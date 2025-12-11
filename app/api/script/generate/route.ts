import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateScriptWithDeepSeek, generateStoryboardWithDeepSeek, continueConversation, DeepSeekMessage } from '@/lib/deepseek';
import { StoryboardData } from '@/types';
import { assertApiKey, validationError, unauthorizedError, maskServerError } from '@/lib/apiAuth';

// CORS 头设置（用于开发环境网络访问）
function setCorsHeaders(response: NextResponse, request?: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    // 开发环境：允许所有来源（用于局域网访问）
    // 注意：如果设置了 credentials，origin 不能是 '*'，必须使用具体 origin
    const origin = request?.headers.get('origin');
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    } else {
      // 如果没有 origin 头（同源请求），允许所有来源
      response.headers.set('Access-Control-Allow-Origin', '*');
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  return response;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  return setCorsHeaders(response, request);
}

export async function POST(request: NextRequest) {
  try {
    assertApiKey(request);

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

      const response = NextResponse.json({
        success: true,
        data: {
          storyboard: storyboardData,
        },
      });
      return setCorsHeaders(response, request);
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

      const response = NextResponse.json({
        success: true,
        data: {
          script,
        },
      });
      return setCorsHeaders(response, request);
    }
  } catch (error: any) {
    console.error('脚本生成失败:', error?.message || error);
    if (error?.status === 401) {
      return unauthorizedError();
    }
    return setCorsHeaders(maskServerError(), request);
  }
}

