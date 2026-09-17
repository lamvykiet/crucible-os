import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { addDays, dayKey, dayStart } from "@/lib/habits";

export const dynamic = "force-dynamic";

const clampMood = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : null;
};

/** Nhật ký, mới nhất trước. Lọc theo thói quen hoặc tìm chữ trong nội dung. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const url = new URL(req.url);
    const habitId = url.searchParams.get("habitId");
    const q = (url.searchParams.get("q") ?? "").trim();
    const days = Math.min(400, Math.max(1, Number(url.searchParams.get("days")) || 120));

    const items = await prisma.habitJournal.findMany({
      where: {
        userId: user.id,
        ...(habitId ? { habitId } : {}),
        ...(q ? { body: { contains: q, mode: "insensitive" as const } } : {}),
        entryDate: { gte: dayStart(addDays(dayKey(), -days)) },
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { habit: { select: { id: true, name: true, color: true } } },
    });

    return NextResponse.json({
      success: true,
      items: items.map((i) => ({
        id: i.id,
        day: i.entryDate.toISOString().slice(0, 10),
        body: i.body,
        mood: i.mood,
        energy: i.energy,
        habit: i.habit,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được nhật ký";
    console.error("Habit journal GET error:", error);
    return NextResponse.json({ success: false, error: message, items: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const text = String(body.body ?? "").trim();
    if (!text) return NextResponse.json({ success: false, error: "Chưa có nội dung" }, { status: 400 });

    // Thói quen phải là của chính người dùng — id lạ thì bỏ, không báo lỗi to.
    let habitId: string | null = body.habitId ? String(body.habitId) : null;
    if (habitId) {
      const owned = await prisma.habit.findFirst({ where: { id: habitId, userId: user.id }, select: { id: true } });
      habitId = owned?.id ?? null;
    }

    const item = await prisma.habitJournal.create({
      data: {
        body: text.slice(0, 4000),
        mood: clampMood(body.mood),
        energy: clampMood(body.energy),
        habitId,
        entryDate: dayStart(/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? String(body.date) : dayKey()),
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được";
    console.error("Habit journal POST error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const owned = await prisma.habitJournal.findFirst({ where: { id: String(body.id ?? ""), userId: user.id } });
    if (!owned) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });

    const item = await prisma.habitJournal.update({
      where: { id: owned.id },
      data: {
        ...(body.body !== undefined ? { body: String(body.body).trim().slice(0, 4000) } : {}),
        ...(body.mood !== undefined ? { mood: clampMood(body.mood) } : {}),
        ...(body.energy !== undefined ? { energy: clampMood(body.energy) } : {}),
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không sửa được";
    console.error("Habit journal PATCH error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const owned = await prisma.habitJournal.findFirst({ where: { id, userId: user.id } });
    if (!owned) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });

    await prisma.habitJournal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không xoá được";
    console.error("Habit journal DELETE error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
