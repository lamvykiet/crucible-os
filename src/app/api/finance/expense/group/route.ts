export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Soi MỘT nhóm chi tiêu.
//
// Các màn hiện có đều nhìn từ trên xuống: tổng tháng, rồi tỷ trọng các nhóm.
// Chúng trả lời "tháng này tiêu bao nhiêu" nhưng không trả lời "riêng nhóm
// Business năm nay thế nào so với năm ngoái" — muốn biết phải tự lọc rồi tự
// cộng.
//
// Endpoint này phục vụ hai chỗ: không gian phân tích nhóm ở tab Chi tiêu, và
// phần theo dõi kỳ thiếu ở tab Lịch sử (cùng một chuỗi tháng, chỉ đọc theo hai
// cách khác nhau).

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

/**
 * Cùng quy ước với mọi route Finance khác: hoàn tiền trừ ngược vào chi tiêu.
 *
 * `kind` phải khớp với loại của nhóm đang xem. Nhóm thu nhập mà đem cộng theo
 * luật chi tiêu thì ra toàn số 0 — trông như "chưa nhập kỳ nào", trong khi thật
 * ra đã nhập đủ. Đúng kiểu sai nguy hiểm nhất ở màn theo dõi kỳ thiếu.
 */
function signedAmount(type: string, amount: number, kind: "expense" | "income"): number {
  const t = type?.trim().toLowerCase();
  if (kind === "income") return t === "income" ? amount : 0;
  if (t === "expense") return amount;
  if (t === "refund") return -amount;
  return 0;
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const group = searchParams.get("group") || "";
    const kind = searchParams.get("kind") === "income" ? "income" : "expense";
    const monthParam = searchParams.get("month") || "";
    if (!group) {
      return NextResponse.json({ success: false, error: "Thiếu tham số `group`" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json(
        { success: false, error: "Tham số `month` phải có dạng YYYY-MM" },
        { status: 400 }
      );
    }

    const year = Number(monthParam.slice(0, 4));
    const monthNum = Number(monthParam.slice(5, 7));

    // Cửa sổ: từ đầu năm TRƯỚC tới hết tháng đang xem. Đủ cho mọi phép so sánh
    // bên dưới (cùng kỳ năm trước, luỹ kế năm trước, chuỗi 24 tháng).
    const windowStart = new Date(Date.UTC(year - 1, 0, 1));
    const windowEnd = new Date(Date.UTC(year, monthNum, 1));
    const seriesStart = new Date(Date.UTC(year, monthNum - 24, 1));

    const rows = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        categoryGroup: group,
        date: {
          gte: windowStart < seriesStart ? windowStart : seriesStart,
          lt: windowEnd,
        },
      },
      select: {
        date: true,
        type: true,
        totalAmount: true,
        subGroup: true,
        supplier: true,
      },
      orderBy: { date: "asc" },
    });

    // --- Chuỗi 24 tháng ---
    const series = new Map<string, { amount: number; count: number }>();
    for (let i = 23; i >= 0; i--) {
      series.set(monthKey(new Date(Date.UTC(year, monthNum - 1 - i, 1))), {
        amount: 0,
        count: 0,
      });
    }

    const bucket = (map: Map<string, { amount: number; count: number }>, key: string, amount: number) => {
      const entry = map.get(key);
      if (!entry) return;
      entry.amount += amount;
      if (amount !== 0) entry.count += 1;
    };

    const thisMonthKey = monthParam;
    const prevMonthKey = monthKey(new Date(Date.UTC(year, monthNum - 2, 1)));
    const lastYearMonthKey = monthKey(new Date(Date.UTC(year - 1, monthNum - 1, 1)));

    let monthTotal = 0;
    let monthCount = 0;
    let prevMonthTotal = 0;
    let prevMonthCount = 0;
    let lastYearMonthTotal = 0;
    let lastYearMonthCount = 0;
    let ytdTotal = 0;
    let ytdCount = 0;
    let lastYtdTotal = 0;
    let lastYtdCount = 0;
    let lastYearFull = 0;

    const subMonth = new Map<string, { amount: number; count: number }>();
    const subYear = new Map<string, { amount: number; count: number }>();
    const merchants = new Map<string, { amount: number; count: number }>();

    for (const r of rows) {
      const amount = signedAmount(r.type, r.totalAmount, kind);
      if (amount === 0) continue;
      const key = monthKey(r.date);
      const rowYear = r.date.getUTCFullYear();
      const rowMonth = r.date.getUTCMonth() + 1;
      const sub = r.subGroup?.trim() || "";
      const who = r.supplier?.trim() || "";

      bucket(series, key, amount);

      if (key === thisMonthKey) {
        monthTotal += amount;
        monthCount += 1;
        const cur = subMonth.get(sub) || { amount: 0, count: 0 };
        subMonth.set(sub, { amount: cur.amount + amount, count: cur.count + 1 });
      }
      if (key === prevMonthKey) {
        prevMonthTotal += amount;
        prevMonthCount += 1;
      }
      if (key === lastYearMonthKey) {
        lastYearMonthTotal += amount;
        lastYearMonthCount += 1;
      }

      if (rowYear === year) {
        ytdTotal += amount;
        ytdCount += 1;
        const cur = subYear.get(sub) || { amount: 0, count: 0 };
        subYear.set(sub, { amount: cur.amount + amount, count: cur.count + 1 });
        const m = merchants.get(who) || { amount: 0, count: 0 };
        merchants.set(who, { amount: m.amount + amount, count: m.count + 1 });
      }
      if (rowYear === year - 1) {
        lastYearFull += amount;
        // Luỹ kế năm trước CẮT tới cùng tháng, để so cho công bằng: so trọn năm
        // trước với mấy tháng đầu năm nay thì tháng nào cũng ra "giảm mạnh".
        if (rowMonth <= monthNum) {
          lastYtdTotal += amount;
          lastYtdCount += 1;
        }
      }
    }

    const monthlySeries = [...series.entries()].map(([name, v]) => ({
      name,
      amount: v.amount,
      count: v.count,
    }));

    // Tháng nào trong 12 tháng gần nhất không có đồng nào — dùng để soi xem có
    // kỳ nào quên nhập. Tháng đang chạy không tính: nó chưa kết thúc.
    const nowKey = monthKey(new Date());
    const missingMonths = monthlySeries
      .slice(-12)
      .filter((m) => m.amount === 0 && m.name !== nowKey)
      .map((m) => m.name);

    const rank = (map: Map<string, { amount: number; count: number }>, total: number) =>
      [...map.entries()]
        .map(([name, v]) => ({
          name,
          amount: v.amount,
          count: v.count,
          share: total > 0 ? Math.round((v.amount / total) * 100) : 0,
        }))
        .filter((x) => x.amount !== 0)
        .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      success: true,
      data: {
        group,
        kind,
        month: monthParam,
        year,
        current: {
          total: monthTotal,
          count: monthCount,
          avg: monthCount > 0 ? Math.round(monthTotal / monthCount) : 0,
        },
        prevMonth: { label: prevMonthKey, total: prevMonthTotal, count: prevMonthCount },
        lastYearMonth: {
          label: lastYearMonthKey,
          total: lastYearMonthTotal,
          count: lastYearMonthCount,
        },
        ytd: { total: ytdTotal, count: ytdCount },
        lastYtd: { total: lastYtdTotal, count: lastYtdCount },
        lastYearFull,
        monthlySeries,
        subGroupsMonth: rank(subMonth, monthTotal),
        subGroupsYear: rank(subYear, ytdTotal),
        merchants: rank(merchants, ytdTotal).slice(0, 8),
        missingMonths,
        hasAnyData: rows.length > 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    console.error("Expense group analysis error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
