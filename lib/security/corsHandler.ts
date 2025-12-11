import { NextRequest, NextResponse } from 'next/server';

const DEV_ALLOWED = ['localhost', '127.0.0.1'];

function isAllowedOrigin(origin: string | null, isDev: boolean): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (isDev) {
      if (DEV_ALLOWED.includes(host)) return true;
      if (host.endsWith('.localhost')) return true;
    }
    const allowed = process.env.ALLOWED_ORIGINS;
    if (allowed) {
      return allowed
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
        .some((domain) => host === domain || host.endsWith(`.${domain}`));
    }
  } catch {
    return false;
  }
  return false;
}

export function applyCors(request: NextRequest, response?: NextResponse): NextResponse {
  const isDev = process.env.NODE_ENV === 'development';
  const origin = request.headers.get('origin');
  const allowed = isAllowedOrigin(origin, isDev);
  const res = response ?? new NextResponse(null, { status: 204 });

  if (allowed && origin) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Vary', 'Origin');
  }
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Max-Age', '600');

  return res;
}

