import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveImageToStorage } from '@/lib/imageStorage';
import { validationError, maskServerError } from '@/lib/apiAuth';
import { withApiProtection } from '@/lib/security/withApiProtection';
import prisma from '@/lib/prisma';

async function postHandler(request: NextRequest, session?: any) {
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

    // Ownership check for scriptId
    if (scriptId && scriptId !== 'unknown') {
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
        select: { userId: true }
      });
      if (script && script.userId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: '无权访问此脚本' },
          { status: 403 }
        );
      }
    }

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
    return maskServerError('保存图片失败，请稍后重试', request, error);
  }
}

export const POST = withApiProtection(postHandler, { requireApiKey: true, requireSession: true });
