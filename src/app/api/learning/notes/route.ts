import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Giấy nhớ, gắn với một ngày.
 *
 * Gắn ngày chứ không thả trôi tự do, để mở lịch sử ngày 12/08 là thấy luôn hôm
 * đó đã ghi gì bên cạnh số thẻ đã ôn.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const date = new URL(req.url).searchParams.get("date")?.trim();

    // Không truyền ngày thì lấy ghi chú hôm nay — đúng nhu cầu khi đang ngồi
    // trong phiên Pomodoro.
    let gte: Date, lt: Date;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      gte = new Date(`${date}T00:00:00.000Z`);
      lt = new Date(gte.getTime() + 86_400_000);
    } else {
      const now = new Date();
      gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      lt = new Date(gte.getTime() + 86_400_000);
    }

    const notes = await prisma.studyNote.findMany({
      where: { userId: user.id, noteDate: { gte, lt } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error("List notes error:", error);
    return NextResponse.json({ success: false, error: "Server Error", notes: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { body, noteDate, color } = await req.json();
    const text = String(body ?? "").trim();
    if (!text) {
      return NextResponse.json({ success: false, error: "Ghi chú trống" }, { status: 400 });
    }

    const note = await prisma.studyNote.create({
      data: {
        body: text.slice(0, 4000),
        noteDate: noteDate ? new Date(String(noteDate)) : new Date(),
        color: color ?? null,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được ghi chú";
    console.error("Create note error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id, body, color } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const owned = await prisma.studyNote.findFirst({ where: { id, userId: user.id } });
    if (!owned) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });

    const note = await prisma.studyNote.update({
      where: { id },
      data: {
        ...(body !== undefined ? { body: String(body).slice(0, 4000) } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    });
    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("Update note error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const result = await prisma.studyNote.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete note error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
