import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredImages } from '@/lib/imageStorage';
import { maskServerError } from '@/lib/apiAuth';
import { withApiProtection } from '@/lib/security/withApiProtection';

async function getHandler(_request: NextRequest) {
  try {
    const deletedCount = await cleanupExpiredImages();

    return NextResponse.json({
      success: true,
      data: {
        deletedCount,
        message: `清理完成，删除了 ${deletedCount} 个过期文件`,
      },
    });
  } catch (error: any) {
    console.error('清理过期图片失败:', error?.message || error);
    return maskServerError('清理失败，请稍后重试');
  }
}

export const GET = withApiProtection(getHandler, { requireApiKey: true });
