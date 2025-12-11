import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveImageToStorage } from '@/lib/imageStorage';
import { assertApiKey, validationError, unauthorizedError, maskServerError } from '@/lib/apiAuth';

function setCorsHeaders(response: NextResponse, request?: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    const origin = request?.headers.get('origin');
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    } else {
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
      imageUrl: z.string().min(1),
      pageNumber: z.number().int(),
      scriptId: z.string().optional(),
      segmentId: z.number().int().optional(),
    });
    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) {
      return setCorsHeaders(validationError(), request);
    }

    const { imageUrl, pageNumber, scriptId, segmentId } = parseResult.data;

    const result = await saveImageToStorage(
      imageUrl,
      pageNumber,
      scriptId || 'unknown',
      segmentId || 0
    );

    return setCorsHeaders(
      NextResponse.json({
        success: true,
        data: result,
      }),
      request
    );
  } catch (error: any) {
    console.error('保存图片失败:', error?.message || error);
    if (error?.status === 401) {
      return unauthorizedError();
    }
    return setCorsHeaders(maskServerError('保存图片失败，请稍后重试'), request);
  }
}
