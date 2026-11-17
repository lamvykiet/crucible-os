import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { loadPathView } from "@/lib/pathServer";
import { isPathLevel } from "@/lib/learningPath";

export const dynamic = "force-dynamic";

/**
 * Lộ trình học của một thứ tiếng.
 * GET: mọi thứ trang Lộ trình cần (xem `loadPathView`).
 * PUT: đặt cấp đang học, band mục tiêu, số phút mỗi ngày.
 */

async function langOf(userId: string, languageId: string | null) {
  if (!languageId) return null;
  return prisma.language.findFirst({
    where: { id: languageId, userId },
    select: { id: true, code: true, script: true },
  });
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const lang = await langOf(user.id, new URL(req.url).searchParams.get("languageId"));
    if (!lang) return NextResponse.json({ success: false, error: "Không tìm thấy thứ tiếng này" }, { status: 404 });
    const view = await loadPathView(user.id, lang);
    return NextResponse.json({ success: true, view });
  } catch (error) {
    console.error("Path load error:", error);
    return NextResponse.json({ success: false, error: "Không đọc được lộ trình" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  try {
    const body = await req.json();
    const lang = await langOf(user.id, body.languageId ?? null);
    if (!lang) return NextResponse.json({ success: false, error: "Không tìm thấy thứ tiếng này" }, { status: 404 });

    const data: { level?: string; targetBand?: string; minutesPerDay?: number } = {};
    if (body.level !== undefined) {
      if (!isPathLevel(body.level)) return NextResponse.json({ success: false, error: "Cấp không hợp lệ" }, { status: 400 });
      data.level = body.level;
    }
    if (body.targetBand !== undefined) {
      const b = Number(body.targetBand);
      if (!Number.isFinite(b) || b < 3 || b > 9) {
        return NextResponse.json({ success: false, error: "Band mục tiêu phải từ 3.0 tới 9.0" }, { status: 400 });
      }
      data.targetBand = b.toFixed(1);
    }
    if (body.minutesPerDay !== undefined) {
      const m = Math.round(Number(body.minutesPerDay));
      if (!Number.isFinite(m) || m < 10 || m > 240) {
        return NextResponse.json({ success: false, error: "Số phút mỗi ngày phải từ 10 tới 240" }, { status: 400 });
      }
      data.minutesPerDay = m;
    }

    await prisma.learningPath.upsert({
      where: { userId_languageId: { userId: user.id, languageId: lang.id } },
      create: {
        userId: user.id, languageId: lang.id, langCode: lang.code,
        level: data.level ?? "B1", targetBand: data.targetBand ?? "6.5", minutesPerDay: data.minutesPerDay ?? 45,
      },
      update: data,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Path save error:", error);
    return NextResponse.json({ success: false, error: "Không lưu được lộ trình" }, { status: 500 });
  }
}
