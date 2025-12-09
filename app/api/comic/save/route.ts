import { NextRequest, NextResponse } from 'next/server';
import { saveImageToStorage } from '@/lib/imageStorage';

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
    const body = await request.json();
    const { imageUrl, pageNumber, scriptId, segmentId } = body;

    if (!imageUrl || pageNumber === undefined) {
      return setCorsHeaders(
        NextResponse.json(
          {
            success: false,
            error: '缺少必要参数: imageUrl, pageNumber',
          },
          { status: 400 }
        ),
        request
      );
    }

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
    console.error('保存图片失败:', error);
    return setCorsHeaders(
      NextResponse.json(
        {
          success: false,
          error: error.message || '保存图片失败',
        },
        { status: 500 }
      ),
      request
    );
  }
}
