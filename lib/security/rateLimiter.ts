import { NextRequest, NextResponse } from 'next/server';

type Bucket = {
  windowStart: number;
  count: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;
const buckets = new Map<string, Bucket>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip;
  }
  const realIp = (req as any).ip as string | undefined;
  if (realIp) return realIp;
  return 'unknown';
}

export function rateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(ip, { windowStart: now, count: 1 });
    return null;
  }

  if (bucket.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000);
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'Too Many Requests',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }

  bucket.count += 1;
  return null;
}

