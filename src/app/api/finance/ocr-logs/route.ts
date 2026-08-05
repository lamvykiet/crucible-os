import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Nhật ký OCR gần đây. `?status=ERROR` để chỉ xem các lượt quét hỏng. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);

    const [logs, errorCount] = await Promise.all([
      prisma.ocrLog.findMany({
        where: { userId: user.id, ...(status ? { status } : {}) },
        orderBy: { timestamp: "desc" },
        take: limit,
      }),
      prisma.ocrLog.count({ where: { userId: user.id, status: "ERROR" } }),
    ]);

    return NextResponse.json({ success: true, logs, errorCount });
  } catch (error) {
    console.error("List OCR logs error:", error);
    return NextResponse.json({ success: false, error: "Server Error", logs: [], errorCount: 0 }, { status: 500 });
  }
}
