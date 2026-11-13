import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Người đang đăng nhập — tên hiển thị và email cho thẻ người dùng ở đáy
 * sidebar. Chỉ trả về chính người gọi, không bao giờ người khác.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { displayName: true, email: true },
    });
    return NextResponse.json({
      success: true,
      displayName: row?.displayName ?? null,
      email: row?.email ?? user.email ?? null,
    });
  } catch (error) {
    console.error("GET /api/me error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
