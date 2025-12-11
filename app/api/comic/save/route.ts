import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveImageToStorage } from '@/lib/imageStorage';
import { validationError, maskServerError } from '@/lib/apiAuth';
import { withApiProtection } from '@/lib/security/withApiProtection';

async function postHandler(request: NextRequest) {
  try {
    const schema = z.object({
      imageUrl: z.string().min(1),
      pageNumber: z.number().int(),
      scriptId: z.string().optional(),
      segmentId: z.number().int().optional(),
    });
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return validationError();
    }

    const { imageUrl, pageNumber, scriptId, segmentId } = parseResult.data;

    const result = await saveImageToStorage(
      imageUrl,
      pageNumber,
      scriptId || 'unknown',
      segmentId || 0
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('保存图片失败:', error?.message || error);
    return maskServerError('保存图片失败，请稍后重试');
  }
}

export const POST = withApiProtection(postHandler, { requireApiKey: true });
