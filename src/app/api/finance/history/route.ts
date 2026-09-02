export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // optional
    // Tham số `type` đã bỏ: lọc theo loại giao dịch giờ chạy trong bộ nhớ ở
    // client cùng với các bộ lọc khác. Giữ lại ở đây thì mỗi lần đổi ô lọc là
    // một vòng gọi mạng thừa, trong khi dữ liệu cả tháng đã nằm sẵn trên máy.

    const userId = user.id;

    const whereClause: {
      userId: string;
      date?: { gte: Date; lt: Date };
    } = { userId };

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);

      whereClause.date = {
        gte: new Date(Date.UTC(year, monthNum - 1, 1)),
        lt: new Date(Date.UTC(year, monthNum, 1)),
      };
    }

    const txs = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
      take: 100,
      include: { items: true }
    });

    return NextResponse.json({
      success: true,
      // `subGroup` và `paymentMethod` PHẢI có mặt ở đây.
      //
      // Thiếu chúng thì form sửa giao dịch mở ra với ô danh mục con trống và
      // cách trả "không rõ", rồi bấm Lưu là ghi đè mất giá trị thật trong DB.
      // 263/267 giao dịch đang có danh mục con, nên lỗi này âm thầm phá gần
      // như mọi lần sửa.
      //
      // `source` và `driveFileId` để form biết đây là hoá đơn quét và hiện lại
      // ảnh gốc cho đối chiếu.
      data: txs.map(t => ({
        id: t.id,
        date: t.date.toISOString().split('T')[0],
        type: t.type,
        supplier: t.supplier || 'Unknown',
        amount: t.totalAmount,
        category: t.categoryGroup || 'Other',
        subGroup: t.subGroup || '',
        paymentMethod: t.paymentMethod || 'unknown',
        source: t.source,
        driveFileId: t.driveFileId || null,
        note: t.notes || '',
        items: t.items || []
      }))
    });
  } catch (error) {
    console.error("History Data Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
