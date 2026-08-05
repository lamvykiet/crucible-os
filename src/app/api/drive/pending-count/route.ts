import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Số hoá đơn đang chờ duyệt — dùng cho badge trên nút "Duyệt hoá đơn (n)".
 *
 * Trước đây phải liệt kê thư mục Drive trên mỗi lần tải dashboard. Nay chỉ là
 * một câu `count` trên bảng bản nháp: rẻ hơn nhiều và không chết theo Drive API.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const count = await prisma.draftReceipt.count({
      where: { userId: user.id, status: "Pending" },
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Failed to count pending drafts:", error);
    return NextResponse.json({ success: false, error: "Server Error", count: 0 }, { status: 500 });
  }
}
