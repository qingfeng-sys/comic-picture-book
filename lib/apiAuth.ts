import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/app/api/_error';

const ENABLE_API_KEY_VERIFICATION = process.env.ENABLE_API_KEY_VERIFICATION === 'true';
const INTERNAL_API_KEY = process.env.API_KEY || process.env.INTERNAL_API_KEY;

export function assertApiKey(request: NextRequest) {
  if (!ENABLE_API_KEY_VERIFICATION) return;

  const provided = request.headers.get('x-api-key');
  if (!INTERNAL_API_KEY || !provided || provided !== INTERNAL_API_KEY) {
    const error: any = new Error('UNAUTHORIZED');
    error.status = 401;
    throw error;
  }
}

export function validationError(message = '请求参数错误') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 400 }
  );
}

export function unauthorizedError(request: NextRequest) {
  return handleApiError(request, new Error('Unauthorized'), '未授权的请求', 401);
}

export function maskServerError(
  message = '服务暂时不可用，请稍后重试',
  request?: NextRequest,
  error?: any
) {
  if (request) {
    return handleApiError(request, error || new Error(message), message, 500);
  }
  return NextResponse.json(
    { success: false, error: message },
    { status: 500 }
  );
}

