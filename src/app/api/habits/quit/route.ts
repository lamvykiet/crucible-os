import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dayKey, dayStart } from "@/lib/habits";

export const dynamic = "force-dynamic";

/**
 * Đặt lại đồng hồ của một thói quen "bỏ".
 *
 * Hai việc trong một lần bấm: dời mốc đếm về hiện tại, và ghi lại lần tái phạm
 * vào ngày hôm nay. Chỉ dời mốc thì đồng hồ về 0 nhưng lịch sử sạch trơn — sau
 * ba tháng không ai còn biết mình đã trượt mấy lần, mà đó mới là con số đáng xem.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { habitId, note } = await req.json();
    const habit = await prisma.habit.findFirst({ where: { id: String(habitId ?? ""), userId: user.id } });
    if (!habit) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });
    if (habit.kind !== "quit") {
      return NextResponse.json({ success: false, error: "Chỉ dùng cho thói quen cần bỏ" }, { status: 400 });
    }

    const entryDate = dayStart(dayKey());
    const text = note ? String(note).trim().slice(0, 300) : null;

    const [updated] = await prisma.$transaction([
      prisma.habit.update({ where: { id: habit.id }, data: { quitSince: new Date() } }),
      prisma.habitEntry.upsert({
        where: { habitId_entryDate: { habitId: habit.id, entryDate } },
        create: { habitId: habit.id, entryDate, userId: user.id, amount: 1, note: text },
        update: { amount: { increment: 1 }, ...(text ? { note: text } : {}) },
      }),
    ]);

    return NextResponse.json({ success: true, habit: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đặt lại được";
    console.error("Habit quit reset error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
