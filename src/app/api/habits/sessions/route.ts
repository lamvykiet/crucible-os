import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { addDays, dayKey, dayStart } from "@/lib/habits";

export const dynamic = "force-dynamic";

/**
 * Ghi lại một phiên tập trung đã chạy.
 *
 * Chỉ ghi khi phiên đã dừng, và ghi **số giây thật sự đã chạy** — bấm 30 phút
 * rồi bỏ ngang ở phút thứ tư thì bảng này phải nói là bốn phút. Thói quen nào
 * chọn nguồn "số phút tập trung" sẽ cộng dồn từ đây, nên phóng đại ở đây là
 * phóng đại luôn cả chuỗi ngày.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const seconds = Math.min(86_400, Math.max(0, Math.round(Number(body.seconds) || 0)));
    // Dưới một phút thì không đáng một dòng lịch sử.
    if (seconds < 60) {
      return NextResponse.json({ success: false, error: "Phiên quá ngắn để ghi lại" }, { status: 400 });
    }

    let habitId: string | null = body.habitId ? String(body.habitId) : null;
    if (habitId) {
      const owned = await prisma.habit.findFirst({ where: { id: habitId, userId: user.id }, select: { id: true } });
      habitId = owned?.id ?? null;
    }

    const startedAt = body.startedAt ? new Date(body.startedAt) : new Date(Date.now() - seconds * 1000);

    const session = await prisma.focusSession.create({
      data: {
        habitId,
        mode: body.mode === "stopwatch" ? "stopwatch" : "countdown",
        targetMinutes: Math.min(600, Math.max(0, Math.round(Number(body.targetMinutes) || 0))),
        seconds,
        note: body.note ? String(body.note).trim().slice(0, 300) : null,
        startedAt: Number.isNaN(startedAt.getTime()) ? new Date(Date.now() - seconds * 1000) : startedAt,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không ghi được phiên tập trung";
    console.error("Focus session POST error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Các phiên gần đây, kèm tổng số phút của hôm nay. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 7));
    const today = dayKey();

    const sessions = await prisma.focusSession.findMany({
      where: { userId: user.id, endedAt: { gte: dayStart(addDays(today, -days)) } },
      orderBy: { endedAt: "desc" },
      take: 100,
      include: { habit: { select: { id: true, name: true, color: true } } },
    });

    const todayMinutes = Math.floor(
      sessions.filter((s) => dayKey(s.endedAt) === today).reduce((sum, s) => sum + s.seconds, 0) / 60
    );

    return NextResponse.json({
      success: true,
      todayMinutes,
      sessions: sessions.map((s) => ({
        id: s.id,
        mode: s.mode,
        minutes: Math.round(s.seconds / 60),
        seconds: s.seconds,
        note: s.note,
        habit: s.habit,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được lịch sử phiên";
    console.error("Focus session GET error:", error);
    return NextResponse.json({ success: false, error: message, sessions: [] }, { status: 500 });
  }
}
