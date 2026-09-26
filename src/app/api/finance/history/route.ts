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
    // Khoảng ngày tuỳ chọn. Có `from`/`to` thì nó THAY cho `month`: người dùng
    // đang hỏi một quãng cụ thể, không phải một tháng. Dùng chung cho bộ lọc
    // "từ ngày — đến ngày" ở tab Lịch sử và cho bảng chi tiết của phần so sánh
    // kỳ (bấm vào một dòng để xem những giao dịch làm nên con số đó).
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
    // Tham số `type` đã bỏ: lọc theo loại giao dịch giờ chạy trong bộ nhớ ở
    // client cùng với các bộ lọc khác. Giữ lại ở đây thì mỗi lần đổi ô lọc là
    // một vòng gọi mạng thừa, trong khi dữ liệu cả tháng đã nằm sẵn trên máy.

    const userId = user.id;

    const whereClause: {
      userId: string;
      date?: { gte: Date; lt: Date };
    } = { userId };

    // Cửa sổ nửa mở [from, to+1 ngày) — `to` là ngày CÓ tính, đúng như người
    // dùng đọc "đến ngày 30/9". Cùng quy ước UTC với /api/finance/day.
    if (isDay(from) || isDay(to)) {
      const start = isDay(from)
        ? new Date(`${from}T00:00:00.000Z`)
        : new Date(Date.UTC(1970, 0, 1));
      const end = isDay(to)
        ? new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)
        : new Date(Date.UTC(9999, 0, 1));
      if (start.getTime() >= end.getTime()) {
        return NextResponse.json(
          { success: false, error: "Ngày bắt đầu phải trước ngày kết thúc" },
          { status: 400 }
        );
      }
      whereClause.date = { gte: start, lt: end };
    } else if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);

      whereClause.date = {
        gte: new Date(Date.UTC(year, monthNum - 1, 1)),
        lt: new Date(Date.UTC(year, monthNum, 1)),
      };
    }

    // Quãng nhiều tháng thì 100 dòng là quá ít — cắt ở đó là giấu bớt giao
    // dịch mà không báo gì. `truncated` để client nói thẳng khi chạm trần.
    const LIMIT = isDay(from) || isDay(to) ? 1000 : 100;
    const txs = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
      take: LIMIT,
      include: { items: true }
    });

    return NextResponse.json({
      success: true,
      truncated: txs.length >= LIMIT,
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
