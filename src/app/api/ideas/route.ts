import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 5_000;
const VALID_STATUS = ["active", "completed", "archived"] as const;

/** Số ngày không đụng tới thì coi là "bỏ trống". */
export const STALE_DAYS = 30;

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const ideas = await prisma.idea.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { lastActiveAt: "desc" }],
    });

    const staleBefore = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;

    return NextResponse.json({
      success: true,
      data: ideas.map((idea) => ({
        ...idea,
        // Tính ở server để mọi nơi dùng chung một định nghĩa. Bản cũ có cờ
        // `stale: true/false` viết cứng trong mảng dữ liệu giả.
        isStale:
          idea.status === "active" && idea.lastActiveAt.getTime() < staleBefore,
      })),
      staleDays: STALE_DAYS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Ideas list error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : null;

    if (!title) {
      return NextResponse.json(
        { success: false, error: "Tiêu đề không được để trống" },
        { status: 400 }
      );
    }

    const idea = await prisma.idea.create({
      data: {
        title: title.slice(0, MAX_TITLE),
        description: description ? description.slice(0, MAX_DESCRIPTION) : null,
        status: VALID_STATUS.includes(body?.status) ? body.status : "active",
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, data: { ...idea, isStale: false } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Idea create error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
