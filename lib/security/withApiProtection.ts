import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from './rateLimiter';
import { applyCors } from './corsHandler';
import { checkApiKey } from './apiAuth';
import { logger } from '@/lib/logger';
import { handleApiError } from '@/app/api/_error';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

type Handler = (request: NextRequest, session?: any) => Promise<NextResponse> | NextResponse;

export interface ProtectionOptions {
  requireApiKey?: boolean;
  requireSession?: boolean;
}

export function withApiProtection(handler: Handler, options?: ProtectionOptions) {
  return async function (request: NextRequest) {
    const started = Date.now();
    const ip = request.headers.get('x-forwarded-for') || (request as any).ip || 'unknown';
    const contentLength = request.headers.get('content-length');

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

    // Session
    let session = null;
    if (options?.requireSession) {
      session = await getServerSession(authOptions);
      if (!session) {
        const res = NextResponse.json(
          { success: false, error: '未授权，请先登录' },
          { status: 401 }
        );
        return applyCors(request, res);
      }
    }

    try {
      const response = await handler(request, session);
      const res = response instanceof NextResponse ? response : NextResponse.json(response);
      applyCors(request, res);
      const cost = Date.now() - started;
      res.headers.set('X-Response-Time', `${cost}ms`);
      res.headers.set('X-Request-Id', request.headers.get('x-request-id') || '');

      logger.info(
        {
          method: request.method,
          path: request.nextUrl?.pathname,
          status: res.status,
          ip,
          contentLength,
          durationMs: cost,
          userId: session?.user?.id || 'anonymous'
        },
        'api_request'
      );
      return res;
    } catch (error: any) {
      const response = handleApiError(request, error);
      applyCors(request, response);
      return response;
    } finally {
      const cost = Date.now() - started;
      logger.debug(
        {
          method: request.method,
          path: request.nextUrl?.pathname,
          ip,
          durationMs: cost,
        },
        'api_request_end'
      );
    }
  };
}

