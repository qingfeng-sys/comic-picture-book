import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiProtection } from '@/lib/security/withApiProtection';
import { validationError, maskServerError } from '@/lib/apiAuth';
import { saveImageToStorage } from '@/lib/imageStorage';
import { generateImageWithQiniu } from '@/lib/providers/qiniu/image';
import { generateOutline } from '@/lib/storyGenerator';
import type { CharacterProfile, GenerationModel } from '@/types';
import { generateImageWithWan, isWanGenerationModel } from '@/lib/providers/dashscope/image';

async function postHandler(request: NextRequest, session: any) {
  try {
    const schema = z.object({
      prompt: z.string().min(1),
      model: z.string().optional(),
      maxCharacters: z.number().int().min(1).max(8).optional(),
    });

    const parseResult = schema.safeParse(await request.json());
    if (!parseResult.success) return validationError();

    const { prompt, model, maxCharacters } = parseResult.data;
    const generationModel = (model as GenerationModel | undefined) || 'gemini-2.5-flash-image';

    // 1) 先从 prompt 生成大纲，拿到角色表（name/role/description/visual）
    const outlineResult = await generateOutline(prompt, []);
    const characters = (outlineResult.outline.characters || []).slice(0, maxCharacters ?? 6);

    // 2) 逐个生成角色立绘并保存到本地（返回同源URL，适合 image_reference）
    const results: CharacterProfile[] = [];
    for (const c of characters) {
      const now = new Date().toISOString();
      const characterId = `character_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

      const portraitPrompt = [
        '儿童绘本卡通角色设定图，半身像，正面，干净纯色背景，线条清晰，色彩柔和，高清细节，统一画风',
        `角色名：${c.name}`,
        c.role ? `角色定位：${c.role}` : '',
        c.description ? `身份/性格/关系：${c.description}` : '',
        c.visual ? `外观要点（必须固定跨帧一致）：${c.visual}` : '',
        '要求：同一角色脸型、发型、服装配色保持一致；不要出现多个人物；不要文字水印',
      ]
        .filter(Boolean)
        .join('。');

      const negative = '多人物，文字，水印，低质量，模糊，畸形，恐怖，暴力';
      const imageUrl = isWanGenerationModel(generationModel)
        ? await generateImageWithWan(portraitPrompt, {
          model: generationModel,
          negative_prompt: negative,
          size: '1024*1024',
        })
        : await generateImageWithQiniu(portraitPrompt, {
          model: generationModel,
          aspect_ratio: '1:1',
          human_fidelity: 0.9,
          negative_prompt: negative,
        });

      // 七牛封装失败时可能返回 placeholder(base64)，这里视为“没参考图”
      const isPlaceholder = imageUrl?.startsWith('data:image/png;base64,iVBORw0KGgoAAA');
      const saved = !isPlaceholder ? await saveImageToStorage(imageUrl, 1, characterId, 0) : null;

      results.push({
        id: characterId,
        name: c.name,
        description: c.description,
        visual: c.visual,
        matchNames: Array.from(new Set([c.name])),
        referenceImageUrl: saved?.url,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        outline: outlineResult.outline,
        characters: results,
        providers: outlineResult.providers,
      },
    });
  } catch (error: any) {
    return maskServerError('自动生成角色库失败，请稍后重试', request, error);
  }
}

export const POST = withApiProtection(postHandler, { requireSession: true });


