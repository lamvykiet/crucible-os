import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { addDays, dayKey, dayStart } from "@/lib/habits";

export const dynamic = "force-dynamic";

/**
 * Ghi tiến độ của một thói quen trong một ngày.
 *
 * Nhận `increment` (bấm "+") hoặc `amount` (nhập thẳng con số). Hai đường đều
 * đổ về cùng một dòng nhờ khoá duy nhất `(habitId, entryDate)` — bấm nhanh mười
 * lần vẫn chỉ có một dòng cho ngày đó, không sinh ra lịch sử rác.
 *
 * Thói quen có `autoSource` khác "manual" thì từ chối ghi: con số của nó đọc từ
 * sổ gốc, cho sửa tay là mở đường cho hai nguồn sự thật.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const habitId = String(body.habitId ?? "");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? String(body.date) : dayKey();

    const habit = await prisma.habit.findFirst({ where: { id: habitId, userId: user.id } });
    if (!habit) return NextResponse.json({ success: false, error: "Không tìm thấy thói quen" }, { status: 404 });

    if (habit.autoSource !== "manual" && body.skipped === undefined && body.note === undefined) {
      return NextResponse.json(
        { success: false, error: "Thói quen này tự đếm từ dữ liệu thật, không sửa tay được" },
        { status: 400 }
      );
    }

    const entryDate = dayStart(date);
    const existing = await prisma.habitEntry.findUnique({
      where: { habitId_entryDate: { habitId, entryDate } },
    });

    let amount = existing?.amount ?? 0;
    if (body.amount !== undefined) amount = Math.max(0, Math.round(Number(body.amount) || 0));
    if (body.increment !== undefined) amount = Math.max(0, amount + Math.round(Number(body.increment) || 0));
    // Ô tick của thói quen "một lần mỗi ngày": bật thì đủ chỉ tiêu, tắt thì về 0.
    if (body.toggle === true) amount = amount >= habit.target ? 0 : habit.target;

    const data = {
      amount: Math.min(amount, 10_000_000),
      skipped: body.skipped === undefined ? (existing?.skipped ?? false) : Boolean(body.skipped),
      note: body.note === undefined ? (existing?.note ?? null) : String(body.note).trim().slice(0, 300) || null,
    };

    const entry = await prisma.habitEntry.upsert({
      where: { habitId_entryDate: { habitId, entryDate } },
      create: { habitId, entryDate, userId: user.id, ...data },
      update: data,
    });

    return NextResponse.json({ success: true, entry: { ...entry, day: date } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không ghi được tiến độ";
    console.error("Habit entry error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Lịch sử thô của một thói quen, dùng cho lịch tháng trên trang chi tiết. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const url = new URL(req.url);
    const habitId = url.searchParams.get("habitId");
    const to = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("to") ?? "")
      ? url.searchParams.get("to")!
      : dayKey();
    const days = Math.min(400, Math.max(1, Number(url.searchParams.get("days")) || 90));

    const entries = await prisma.habitEntry.findMany({
      where: {
        userId: user.id,
        ...(habitId ? { habitId } : {}),
        entryDate: { gte: dayStart(addDays(to, -days)), lt: dayStart(addDays(to, 1)) },
      },
      orderBy: { entryDate: "asc" },
    });

    return NextResponse.json({
      success: true,
      entries: entries.map((e) => ({
        id: e.id,
        habitId: e.habitId,
        day: e.entryDate.toISOString().slice(0, 10),
        amount: e.amount,
        skipped: e.skipped,
        note: e.note,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được lịch sử";
    console.error("Habit entries GET error:", error);
    return NextResponse.json({ success: false, error: message, entries: [] }, { status: 500 });
  }
}
