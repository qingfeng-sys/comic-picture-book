import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export function handleApiError(request: NextRequest, error: any, message?: string, status = 500) {
  const errorId = crypto.randomUUID();
  const safeMessage = message || '服务暂时不可用，请稍后重试';

  logger.error(
    {
      errorId,
      method: request.method,
      url: request.nextUrl?.pathname,
      ip: request.headers.get('x-forwarded-for') || (request as any).ip,
      error: error?.message || error,
      stack: error?.stack,
    },
    'api_error'
  );

  return NextResponse.json(
    { success: false, error: safeMessage, errorId },
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Id': errorId,
      },
    }
  );
}

