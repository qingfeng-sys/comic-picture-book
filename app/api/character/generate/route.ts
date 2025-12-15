import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiProtection } from '@/lib/security/withApiProtection';
import { validationError, maskServerError } from '@/lib/apiAuth';
import { saveImageToStorage } from '@/lib/imageStorage';
import { generateImageWithQiniu } from '@/lib/providers/qiniu/image';
import { GenerationModel } from '@/types';
import { generateImageWithWan, isWanGenerationModel } from '@/lib/providers/dashscope/image';

async function postHandler(request: NextRequest) {
  try {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      visual: z.string().optional(),
      model: z.string().optional(), // 复用现有 GenerationModel 字符串
    });

    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) return validationError();

    const { name, description, visual, model } = parseResult.data;
    const generationModel = (model as GenerationModel | undefined) || 'gemini-2.5-flash-image';

    // 角色立绘提示词：尽量“固定脸 + 固定服装”，为后续 image_reference 提供稳定参考
    const prompt = [
      '儿童绘本卡通角色设定图，半身像，正面，干净纯色背景，线条清晰，色彩柔和，高清细节，统一画风',
      `角色名：${name}`,
      description ? `身份/性格/关系：${description}` : '',
      visual ? `外观要点（必须固定跨帧一致）：${visual}` : '',
      '要求：同一角色脸型、发型、服装配色保持一致；不要出现多个人物；不要文字水印',
    ]
      .filter(Boolean)
      .join('。');

    const negative = '多人物，文字，水印，低质量，模糊，畸形，恐怖，暴力';

    const imageUrl = isWanGenerationModel(generationModel)
      ? await generateImageWithWan(prompt, {
        model: generationModel,
        negative_prompt: negative,
        size: '1024*1024',
      })
      : await generateImageWithQiniu(prompt, {
        model: generationModel,
        aspect_ratio: '1:1',
        human_fidelity: 0.9,
        negative_prompt: negative,
      });

    // 七牛封装会在失败时返回 placeholder(base64)，这里视为失败
    if (!imageUrl || imageUrl.startsWith('data:image/png;base64,iVBORw0KGgoAAA')) {
      return NextResponse.json({ success: false, error: '角色立绘生成失败，请稍后重试' }, { status: 502 });
    }

    const characterId = `character_${Date.now()}`;
    const saved = await saveImageToStorage(imageUrl, 1, characterId, 0);

    return NextResponse.json({
      success: true,
      data: {
        characterId,
        imageUrl: saved.url,
      },
    });
  } catch (error: any) {
    return maskServerError('角色立绘生成失败，请稍后重试', request, error);
  }
}

export const POST = withApiProtection(postHandler, { requireApiKey: true });


