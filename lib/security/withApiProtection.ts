import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from './rateLimiter';
import { applyCors } from './corsHandler';
import { checkApiKey } from './apiAuth';

type Handler = (request: NextRequest) => Promise<NextResponse> | NextResponse;

export interface ProtectionOptions {
  requireApiKey?: boolean;
}

export function withApiProtection(handler: Handler, options?: ProtectionOptions) {
  return async function (request: NextRequest) {
    const started = Date.now();

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return applyCors(request);
    }

    // Rate limit
    const limited = rateLimit(request);
    if (limited) return applyCors(request, limited);

    // API key
    if (options?.requireApiKey) {
      const unauthorized = checkApiKey(request);
      if (unauthorized) return applyCors(request, unauthorized);
    }

    try {
      const response = await handler(request);
      const res = response instanceof NextResponse ? response : NextResponse.json(response);
      applyCors(request, res);
      const cost = Date.now() - started;
      res.headers.set('X-Response-Time', `${cost}ms`);
      return res;
    } catch (error: any) {
      const res = NextResponse.json(
        { success: false, error: '服务暂时不可用，请稍后重试' },
        { status: 500 }
      );
      applyCors(request, res);
      console.error('[API_ERROR]', request.url, error?.message || error);
      return res;
    } finally {
      const cost = Date.now() - started;
      console.log(`[API] ${request.method} ${request.nextUrl.pathname} - ${cost}ms`);
    }
  };
}

