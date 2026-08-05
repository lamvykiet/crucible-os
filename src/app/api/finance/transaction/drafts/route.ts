import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Hàng đợi hoá đơn chờ duyệt.
 *
 * Bản cũ liệt kê thư mục Drive rồi tải từng file `draft_*.json` về để parse:
 * mỗi lần mở hàng đợi là N+1 lượt gọi Drive API, và vì Drive dùng chung một tài
 * khoản nên mọi người dùng đều thấy bản nháp của nhau. Giờ chỉ là một câu truy
 * vấn có lọc `userId`.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const drafts = await prisma.draftReceipt.findMany({
      where: { userId: user.id, status: "Pending" },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, count: drafts.length, drafts });
  } catch (error) {
    console.error("List drafts error:", error);
    const message = error instanceof Error ? error.message : "Không đọc được hàng đợi";
    return NextResponse.json(
      { success: false, error: message, count: 0, drafts: [] },
      { status: 500 }
    );
  }
}
