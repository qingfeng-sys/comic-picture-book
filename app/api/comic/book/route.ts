import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withApiProtection } from "@/lib/security/withApiProtection";
import { z } from "zod";

const comicBookSchema = z.object({
  id: z.string().optional(),
  scriptId: z.string().optional(),
  segmentId: z.number().int().optional(),
  title: z.string().min(1),
  pages: z.array(z.any()).optional(), // 放宽对页面内部结构的校验
});

/**
 * GET /api/comic/book - 获取当前用户的所有绘本
 */
async function getHandler(request: NextRequest, session: any) {
  try {
    const comicBooks = await prisma.comicBook.findMany({
      where: { userId: session.user.id },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: comicBooks });
  } catch (error) {
    console.error("获取绘本失败:", error);
    return NextResponse.json({ success: false, error: "获取绘本失败" }, { status: 500 });
  }
}

/**
 * POST /api/comic/book - 保存绘本及其页面
 */
async function postHandler(request: NextRequest, session: any) {
  try {
    const body = await request.json();
    console.log("[API][ComicBook] 收到请求体:", JSON.stringify(body).substring(0, 200) + "...");
    const result = comicBookSchema.safeParse(body);

    if (!result.success) {
      console.error("[API][ComicBook] Zod 校验失败:", result.error.format());
      return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });
    }

    const { id, scriptId, segmentId, title, pages } = result.data;

    // 1. 检查所有权（如果是更新）或关联脚本所有权
    if (id) {
      const existing = await prisma.comicBook.findUnique({ where: { id } });
      if (!existing || existing.userId !== session.user.id) {
        return NextResponse.json({ success: false, error: "绘本不存在或无权修改" }, { status: 403 });
      }
    } else {
      // 创建模式下，必须提供 scriptId 和 pages
      if (!scriptId || !pages) {
        return NextResponse.json({ success: false, error: "创建新绘本必须提供脚本ID和页面数据" }, { status: 400 });
      }
      const script = await prisma.script.findUnique({ where: { id: scriptId } });
      if (!script || script.userId !== session.user.id) {
        return NextResponse.json({ success: false, error: "关联脚本无效或无权访问" }, { status: 403 });
      }
    }

    // 2. 更新或创建绘本
    let comicBook;
    if (id) {
      // 更新逻辑
      comicBook = await prisma.comicBook.update({
        where: { id },
        data: {
          title,
          updatedAt: new Date(),
        },
        include: { pages: { orderBy: { pageNumber: "asc" } } }
      });
    } else {
      // 创建逻辑
      comicBook = await prisma.comicBook.create({
        data: {
          userId: session.user.id,
          scriptId: scriptId as string,
          title,
          pages: {
            create: (pages || []).map(p => ({
              pageNumber: p.pageNumber,
              imageUrl: p.imageUrl,
              ossKey: p.ossKey,
              dialogue: p.dialogue || [],
              narration: p.narration,
            }))
          }
        },
        include: { pages: { orderBy: { pageNumber: "asc" } } }
      });
    }

    return NextResponse.json({ success: true, data: comicBook });
  } catch (error) {
    console.error("保存绘本失败:", error);
    return NextResponse.json({ success: false, error: "保存绘本失败" }, { status: 500 });
  }
}

async function deleteHandler(request: NextRequest, session: any) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "缺少 ID" }, { status: 400 });
    }

    // 校验所有权
    const existing = await prisma.comicBook.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "绘本不存在或无权删除" }, { status: 403 });
    }

    await prisma.comicBook.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除绘本失败:", error);
    return NextResponse.json({ success: false, error: "删除绘本失败" }, { status: 500 });
  }
}

export const GET = withApiProtection(getHandler, { requireSession: true });
export const POST = withApiProtection(postHandler, { requireSession: true });
export const DELETE = withApiProtection(deleteHandler, { requireSession: true });

