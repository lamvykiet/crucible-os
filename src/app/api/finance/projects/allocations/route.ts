export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { saveAllocations, syncProjectLedger, ProjectSplitError } from "@/lib/projectLedger";

/**
 * Phân bổ lại một giao dịch ĐÃ GHI cho một hay nhiều dự án — "API 1" của bản
 * thiết kế PCT.
 *
 * Body: `{ transactionId, allocations: [{ projectId, costCategory, percentage, notes }] }`.
 * Thay hẳn phân bổ cũ; danh sách rỗng là gỡ khỏi mọi dự án. Số tiền mỗi phần do
 * máy chủ tính từ tổng giao dịch × %, không nhận từ client — nhận thì hai con
 * số có thể lệch nhau.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const transactionId = String(body.transactionId ?? "");
    const t = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
      select: { id: true, type: true, totalAmount: true },
    });
    if (!t) {
      return NextResponse.json({ success: false, error: "Không tìm thấy giao dịch" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await saveAllocations(tx, {
        userId: user.id,
        transactionId: t.id,
        type: t.type,
        totalAmount: t.totalAmount,
        rawSplits: Array.isArray(body.allocations) ? body.allocations : [],
      });
      await syncProjectLedger(tx, user.id, [t.id]);
    });

    const allocations = await prisma.projectAllocation.findMany({ where: { transactionId: t.id } });
    return NextResponse.json({ success: true, data: allocations });
  } catch (error) {
    if (error instanceof ProjectSplitError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
