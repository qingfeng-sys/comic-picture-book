import { NextRequest, NextResponse } from 'next/server';
import { dashscopeSTT } from '@/lib/providers/dashscope/audio';
import { withApiProtection } from '@/lib/security/withApiProtection';
import { maskServerError } from '@/lib/apiAuth';

async function postHandler(request: NextRequest) {
  try {
    const { audioUrl } = await request.json();
    if (!audioUrl) {
      return NextResponse.json({ success: false, error: '缺少音频URL' }, { status: 400 });
    }

    const text = await dashscopeSTT(audioUrl);
    return NextResponse.json({ success: true, data: { text } });
  } catch (error: any) {
    return maskServerError('语音识别失败', request, error);
  }
}

export const POST = withApiProtection(postHandler, { requireApiKey: true });

