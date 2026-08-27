export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Chi tiết giao dịch của MỘT ngày.
//
// Dashboard chỉ có "Chi tiêu ngày: 40.000 ₫" — một con số tổng, không nói được
// đó là những khoản nào. Endpoint này trả về danh sách thật, dùng chung cho hai
// chỗ: thẻ "Hôm nay" trên Dashboard và khi bấm vào một cột trong biểu đồ
// "Xu hướng chi theo ngày" bên tab Chi tiêu.
//
// Mốc thời gian tính bằng UTC, cùng quy ước với /api/finance/dashboard: cửa sổ
// nửa mở [ngày, ngày+1). Xem chú thích dài ở route đó để biết vì sao.

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const requested = searchParams.get("date");
    const date =
      requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
        ? requested
        : new Date().toISOString().slice(0, 10);

    const [y, m, d] = date.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    // Ngày yêu cầu không tồn tại (31/02 chẳng hạn) thì Date.UTC tự cuộn sang
    // tháng sau. Bắt lại thay vì trả về dữ liệu của một ngày khác.
    if (start.getUTCDate() !== d || start.getUTCMonth() !== m - 1) {
      return NextResponse.json(
        { success: false, error: "Ngày không hợp lệ" },
        { status: 400 }
      );
    }

    const tx = await prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
      include: { items: { select: { id: true } } },
    });

    const transactions = tx.map((t) => ({
      id: t.id,
      supplier: t.supplier || "",
      type: t.type,
      categoryGroup: t.categoryGroup || "",
      subGroup: t.subGroup || "",
      totalAmount: t.totalAmount,
      paymentMethod: t.paymentMethod || "unknown",
      source: t.source,
      notes: t.notes || "",
      itemCount: t.items.length,
      // Những chỗ còn trống — client hiện cờ để bấm vào bổ sung, thay vì để
      // người dùng tự phát hiện bằng cách mở từng giao dịch.
      missing: {
        subGroup: !t.subGroup,
        paymentMethod: !t.paymentMethod || t.paymentMethod === "unknown",
        items: t.items.length === 0,
      },
    }));

    const sum = (kind: string) =>
      transactions
        .filter((t) => t.type?.trim().toLowerCase() === kind)
        .reduce((s, t) => s + t.totalAmount, 0);

    return NextResponse.json({
      success: true,
      data: {
        date,
        transactions,
        count: transactions.length,
        income: sum("income"),
        expense: sum("expense"),
        incompleteCount: transactions.filter(
          (t) => t.missing.subGroup || t.missing.paymentMethod || t.missing.items
        ).length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
