import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredImages } from '@/lib/imageStorage';

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
    console.error('清理过期图片失败:', error);
    return setCorsHeaders(
      NextResponse.json(
        {
          success: false,
          error: error.message || '清理失败',
        },
        { status: 500 }
      ),
      request
    );
  }
}
