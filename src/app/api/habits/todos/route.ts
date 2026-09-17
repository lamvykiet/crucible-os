import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { addDays, dayKey, dayStart } from "@/lib/habits";

export const dynamic = "force-dynamic";

const timeOrNull = (v: unknown): string | null =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null;

const dateOrNull = (v: unknown): Date | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? dayStart(v) : null;

/**
 * Việc cần làm.
 *
 * Mặc định trả việc chưa xong tới hết ngày đang xem, cộng với việc đã xong
 * trong chính ngày đó. Việc quá hạn vẫn nổi lên trên — trôi mất một việc chỉ vì
 * hôm qua quên bấm là cách nhanh nhất để người ta thôi tin vào danh sách.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const url = new URL(req.url);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") ?? "")
      ? url.searchParams.get("date")!
      : dayKey();

    const items = await prisma.habitTodo.findMany({
      where: {
        userId: user.id,
        OR: [
          { doneAt: null, OR: [{ dueDate: null }, { dueDate: { lt: dayStart(addDays(date, 1)) } }] },
          { doneAt: { gte: dayStart(date), lt: dayStart(addDays(date, 1)) } },
        ],
      },
      orderBy: [{ doneAt: "asc" }, { dueDate: "asc" }, { dueTime: "asc" }, { sortOrder: "asc" }],
      take: 200,
    });

    return NextResponse.json({
      success: true,
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        note: i.note,
        due: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : null,
        dueTime: i.dueTime,
        flagged: i.flagged,
        done: i.doneAt !== null,
        overdue: i.doneAt === null && i.dueDate !== null && i.dueDate.toISOString().slice(0, 10) < date,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được danh sách việc";
    console.error("Habit todos GET error:", error);
    return NextResponse.json({ success: false, error: message, items: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ success: false, error: "Chưa có tên việc" }, { status: 400 });

    const item = await prisma.habitTodo.create({
      data: {
        title: title.slice(0, 160),
        note: body.note ? String(body.note).trim().slice(0, 500) : null,
        dueDate: dateOrNull(body.due) ?? dayStart(dayKey()),
        dueTime: timeOrNull(body.dueTime),
        flagged: Boolean(body.flagged),
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thêm được việc";
    console.error("Habit todos POST error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const owned = await prisma.habitTodo.findFirst({ where: { id: String(body.id ?? ""), userId: user.id } });
    if (!owned) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });

    const item = await prisma.habitTodo.update({
      where: { id: owned.id },
      data: {
        ...(body.title !== undefined ? { title: String(body.title).trim().slice(0, 160) } : {}),
        ...(body.note !== undefined ? { note: String(body.note).trim().slice(0, 500) || null } : {}),
        ...(body.due !== undefined ? { dueDate: dateOrNull(body.due) } : {}),
        ...(body.dueTime !== undefined ? { dueTime: timeOrNull(body.dueTime) } : {}),
        ...(body.flagged !== undefined ? { flagged: Boolean(body.flagged) } : {}),
        ...(body.done !== undefined ? { doneAt: body.done ? new Date() : null } : {}),
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không sửa được việc";
    console.error("Habit todos PATCH error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const owned = await prisma.habitTodo.findFirst({ where: { id, userId: user.id } });
    if (!owned) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });

    await prisma.habitTodo.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không xoá được việc";
    console.error("Habit todos DELETE error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
