import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withApiProtection } from "@/lib/security/withApiProtection";
import { z } from "zod";

const scriptSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "标题不能为空"),
  content: z.string().min(1, "内容不能为空"),
  storyboard: z.any().optional(),
});

/**
 * GET /api/script - 获取当前用户的所有脚本
 */
async function getHandler(request: NextRequest, session: any) {
  try {
    const scripts = await prisma.script.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: scripts });
  } catch (error) {
    console.error("获取脚本失败:", error);
    return NextResponse.json({ success: false, error: "获取脚本失败" }, { status: 500 });
  }
}

/**
 * POST /api/script - 保存或更新脚本
 */
async function postHandler(request: NextRequest, session: any) {
  try {
    const body = await request.json();
    const result = scriptSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });
    }

    const { id, title, content, storyboard } = result.data;

    let script;
    if (id && id.startsWith('script_')) {
        // 如果是带前缀的临时ID，或者是新保存，我们创建新记录
        script = await prisma.script.create({
            data: {
              title,
              content,
              storyboard: storyboard || {},
              userId: session.user.id,
            },
          });
    } else if (id) {
      // 更新现有脚本
      // 校验所有权
      const existing = await prisma.script.findUnique({ where: { id } });
      if (existing && existing.userId !== session.user.id) {
        return NextResponse.json({ success: false, error: "无权修改此脚本" }, { status: 403 });
      }

      script = await prisma.script.update({
        where: { id },
        data: { title, content, storyboard: storyboard || {} },
      });
    } else {
      // 创建新脚本
      script = await prisma.script.create({
        data: {
          title,
          content,
          storyboard: storyboard || {},
          userId: session.user.id,
        },
      });
    }

    return NextResponse.json({ success: true, data: script });
  } catch (error) {
    console.error("保存脚本失败:", error);
    return NextResponse.json({ success: false, error: "保存脚本失败" }, { status: 500 });
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
    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "脚本不存在或无权删除" }, { status: 403 });
    }

    await prisma.script.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除脚本失败:", error);
    return NextResponse.json({ success: false, error: "删除脚本失败" }, { status: 500 });
  }
}

export const GET = withApiProtection(getHandler, { requireSession: true });
export const POST = withApiProtection(postHandler, { requireSession: true });
export const DELETE = withApiProtection(deleteHandler, { requireSession: true });

