import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withApiProtection } from "@/lib/security/withApiProtection";
import { z } from "zod";

const characterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  role: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  visual: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  sourceType: z.string().optional(),
  sourceScriptId: z.string().optional().nullable(),
  sourceScriptTitle: z.string().optional().nullable(),
  matchNames: z.array(z.string()).optional(),
});

/**
 * GET /api/character - 获取当前用户的所有角色
 */
async function getHandler(request: NextRequest, session: any) {
  try {
    const characters = await prisma.character.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });

    const mapped = characters.map(c => ({
        id: c.id,
        name: c.name,
        role: c.role,
        description: c.description,
        visual: c.visual,
        referenceImageUrl: c.imageUrl,
        sourceType: c.sourceType,
        sourceScriptId: c.sourceScriptId,
        sourceScriptTitle: c.sourceScriptTitle,
        matchNames: c.matchNames,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    console.error("获取角色失败:", error);
    return NextResponse.json({ success: false, error: "获取角色失败" }, { status: 500 });
  }
}

/**
 * POST /api/character - 保存或更新角色
 */
async function postHandler(request: NextRequest, session: any) {
  try {
    const body = await request.json();
    const result = characterSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });
    }

    const { 
        id, name, role, description, visual, imageUrl,
        sourceType, sourceScriptId, sourceScriptTitle, matchNames 
    } = result.data;

    // 判断是更新还是创建
    // 如果 ID 是数据库生成的 cuid (通常是较长字符串且不带前缀)，则是更新
    // 如果 ID 带 character_ 或 char_ 前缀，或者是新生成的，则是创建/覆盖
    const isTempId = !id || id.startsWith('character_') || id.startsWith('char_');

    let character;
    if (!isTempId) {
      // 1. 尝试按 ID 更新
      const existing = await prisma.character.findUnique({ where: { id } });
      if (existing && existing.userId !== session.user.id) {
        return NextResponse.json({ success: false, error: "无权修改此角色" }, { status: 403 });
      }

      character = await prisma.character.update({
        where: { id },
        data: { 
            name, role, description, visual, imageUrl,
            sourceType: sourceType || undefined,
            sourceScriptId: sourceScriptId || undefined,
            sourceScriptTitle: sourceScriptTitle || undefined,
            matchNames: matchNames || undefined,
        },
      });
    } else {
      // 2. 按 userId + name 进行 upsert，防止同名角色冲突
      character = await prisma.character.upsert({
        where: {
          userId_name: {
            userId: session.user.id,
            name: name,
          }
        },
        update: { 
            role, description, visual, imageUrl,
            sourceType: sourceType || undefined,
            sourceScriptId: sourceScriptId || undefined,
            sourceScriptTitle: sourceScriptTitle || undefined,
            matchNames: matchNames || undefined,
        },
        create: {
          userId: session.user.id,
          name,
          role,
          description,
          visual,
          imageUrl,
          sourceType: sourceType || "custom",
          sourceScriptId: sourceScriptId || undefined,
          sourceScriptTitle: sourceScriptTitle || undefined,
          matchNames: matchNames || [name],
        },
      });
    }

    return NextResponse.json({ success: true, data: character });
  } catch (error) {
    console.error("保存角色失败:", error);
    return NextResponse.json({ success: false, error: "保存角色失败" }, { status: 500 });
  }
}

/**
 * DELETE /api/character - 删除角色
 */
async function deleteHandler(request: NextRequest, session: any) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "缺少 ID" }, { status: 400 });
    }

    const existing = await prisma.character.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "角色不存在或无权删除" }, { status: 403 });
    }

    await prisma.character.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除角色失败:", error);
    return NextResponse.json({ success: false, error: "删除角色失败" }, { status: 500 });
  }
}

export const GET = withApiProtection(getHandler, { requireSession: true });
export const POST = withApiProtection(postHandler, { requireSession: true });
export const DELETE = withApiProtection(deleteHandler, { requireSession: true });
