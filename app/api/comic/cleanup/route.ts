import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredImages } from '@/lib/imageStorage';
import { assertApiKey, unauthorizedError, maskServerError } from '@/lib/apiAuth';

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

export async function GET(request: NextRequest) {
  try {
    assertApiKey(request);
    const deletedCount = await cleanupExpiredImages();

    return setCorsHeaders(
      NextResponse.json({
        success: true,
        data: {
          deletedCount,
          message: `清理完成，删除了 ${deletedCount} 个过期文件`,
        },
      }),
      request
    );
  } catch (error: any) {
    console.error('清理过期图片失败:', error?.message || error);
    if (error?.status === 401) {
      return unauthorizedError();
    }
    return setCorsHeaders(maskServerError('清理失败，请稍后重试'), request);
  }
}
