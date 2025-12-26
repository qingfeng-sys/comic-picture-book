import { NextRequest, NextResponse } from 'next/server';
import { dashscopeTTS } from '@/lib/providers/dashscope/audio';
import { withApiProtection } from '@/lib/security/withApiProtection';
import { maskServerError } from '@/lib/apiAuth';

async function postHandler(request: NextRequest) {
  try {
    const { text, voiceId } = await request.json();
    if (!text) {
      return NextResponse.json({ success: false, error: '缺少文本内容' }, { status: 400 });
    }

    const audioUrl = await dashscopeTTS(text, voiceId);
    return NextResponse.json({ success: true, data: { audioUrl } });
  } catch (error: any) {
    return maskServerError('语音合成失败', request, error);
  }
}

export const POST = withApiProtection(postHandler, { requireApiKey: true });

