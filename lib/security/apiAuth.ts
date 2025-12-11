import { NextRequest, NextResponse } from 'next/server';

const ENABLE_API_KEY_VERIFICATION = process.env.ENABLE_API_KEY_VERIFICATION === 'true';
const INTERNAL_API_KEY = process.env.API_KEY || process.env.INTERNAL_API_KEY;

export function checkApiKey(request: NextRequest): NextResponse | null {
  if (!ENABLE_API_KEY_VERIFICATION) return null;
  const provided = request.headers.get('x-api-key');
  if (!INTERNAL_API_KEY || !provided || provided !== INTERNAL_API_KEY) {
    return new NextResponse(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return null;
}

