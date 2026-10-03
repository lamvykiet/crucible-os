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

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
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

/** Các mốc chia khoản chi theo cỡ. Dùng để thấy "ít khoản to" hay "nhiều khoản nhỏ". */
const SIZE_BUCKETS: { label: string; max: number }[] = [
  { label: "< 100k", max: 100_000 },
  { label: "100k – 500k", max: 500_000 },
  { label: "500k – 1tr", max: 1_000_000 },
  { label: "1tr – 5tr", max: 5_000_000 },
  { label: "≥ 5tr", max: Infinity },
];

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

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

    // Cửa sổ: từ đầu năm TRƯỚC tới hết tháng đang xem, và ít nhất 24 tháng.
    const windowEnd = new Date(Date.UTC(year, monthNum, 1));
    const seriesStart = new Date(Date.UTC(year, monthNum - 24, 1));
    const yearStart = new Date(Date.UTC(year - 1, 0, 1));
    const windowStart = yearStart < seriesStart ? yearStart : seriesStart;

    const [rows, allRows] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          categoryGroup: group,
          date: { gte: windowStart, lt: windowEnd },
        },
        select: {
          date: true,
          type: true,
          totalAmount: true,
          subGroup: true,
          supplier: true,
        },
        orderBy: { date: "asc" },
      }),
      // Tổng chi MỌI nhóm, để tính nhóm này chiếm bao nhiêu phần trăm mỗi tháng.
      prisma.transaction.findMany({
        where: { userId: user.id, date: { gte: seriesStart, lt: windowEnd } },
        select: { date: true, type: true, totalAmount: true },
      }),
    ]);

    // --- Khung 24 tháng ---
    const monthKeys: string[] = [];
    for (let i = 23; i >= 0; i--) {
      monthKeys.push(monthKey(new Date(Date.UTC(year, monthNum - 1 - i, 1))));
    }
    const monthIndex = new Set(monthKeys);

    const series = new Map<string, { amount: number; count: number }>();
    for (const k of monthKeys) series.set(k, { amount: 0, count: 0 });

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
    const subTotals = new Map<string, number>();

    // Tiền theo tháng × danh mục con, kèm TỪNG DÒNG để chú giải nói được ngày
    // phát sinh. Không gom sẵn thành chuỗi ở đây: client cần số để sắp xếp.
    const byMonthSub = new Map<string, Map<string, { amount: number; days: { date: string; amount: number; supplier: string }[] }>>();

    // Phân bố theo cỡ khoản và theo thứ trong tuần — chỉ tính 12 tháng gần nhất
    // để nó nói về thói quen HIỆN TẠI, không bị hai năm trước kéo lệch.
    const recentFrom = monthKeys[12];
    const sizeCounts = SIZE_BUCKETS.map(() => ({ count: 0, amount: 0 }));
    const weekday = WEEKDAYS.map(() => ({ amount: 0, count: 0 }));

    const monthlyCum = new Map<string, number>(); // "YYYY-MM" -> amount, cho luỹ kế

    for (const r of rows) {
      const amount = signedAmount(r.type, r.totalAmount, kind);
      if (amount === 0) continue;
      const mKey = monthKey(r.date);
      const rowYear = r.date.getUTCFullYear();
      const rowMonth = r.date.getUTCMonth() + 1;
      const sub = r.subGroup?.trim() || "";
      const who = r.supplier?.trim() || "";

      monthlyCum.set(mKey, (monthlyCum.get(mKey) || 0) + amount);

      if (monthIndex.has(mKey)) {
        const entry = series.get(mKey)!;
        entry.amount += amount;
        entry.count += 1;

        if (!byMonthSub.has(mKey)) byMonthSub.set(mKey, new Map());
        const bucket = byMonthSub.get(mKey)!;
        const cur = bucket.get(sub) || { amount: 0, days: [] };
        cur.amount += amount;
        cur.days.push({ date: dayKey(r.date), amount, supplier: who });
        bucket.set(sub, cur);

        subTotals.set(sub, (subTotals.get(sub) || 0) + amount);

        if (mKey >= recentFrom && amount > 0) {
          const idx = SIZE_BUCKETS.findIndex((b) => amount < b.max);
          const slot = sizeCounts[idx === -1 ? SIZE_BUCKETS.length - 1 : idx];
          slot.count += 1;
          slot.amount += amount;

          const w = weekday[r.date.getUTCDay()];
          w.amount += amount;
          w.count += 1;
        }
      }

      if (mKey === thisMonthKey) {
        monthTotal += amount;
        monthCount += 1;
        const cur = subMonth.get(sub) || { amount: 0, count: 0 };
        subMonth.set(sub, { amount: cur.amount + amount, count: cur.count + 1 });
      }
      if (mKey === prevMonthKey) {
        prevMonthTotal += amount;
        prevMonthCount += 1;
      }
      if (mKey === lastYearMonthKey) {
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

    // Tổng chi mọi nhóm theo tháng, để tính tỷ trọng.
    const allByMonth = new Map<string, number>();
    for (const r of allRows) {
      const amount = signedAmount(r.type, r.totalAmount, kind);
      if (amount === 0) continue;
      const k = monthKey(r.date);
      if (!monthIndex.has(k)) continue;
      allByMonth.set(k, (allByMonth.get(k) || 0) + amount);
    }

    // Danh mục con xếp theo tổng của cả cửa sổ: thứ tự phải CỐ ĐỊNH qua mọi
    // tháng, nếu không mỗi cột lại xếp một kiểu và không so được bằng mắt.
    const subNames = [...subTotals.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const monthlySeries = monthKeys.map((name) => {
      const s = series.get(name)!;
      const bucket = byMonthSub.get(name);
      const row: Record<string, string | number> = { name, amount: s.amount, count: s.count };
      for (const sub of subNames) {
        row[sub || "__none"] = bucket?.get(sub)?.amount || 0;
      }
      return row;
    });

    // Chi tiết từng ô của cột chồng, cho chú giải: tên danh mục con, số tiền,
    // và những ngày phát sinh trong tháng đó.
    const details: Record<string, Record<string, { amount: number; days: { date: string; amount: number; supplier: string }[] }>> = {};
    for (const [m, bucket] of byMonthSub.entries()) {
      details[m] = {};
      for (const [sub, v] of bucket.entries()) {
        details[m][sub || "__none"] = {
          amount: v.amount,
          days: v.days.sort((a, b) => a.date.localeCompare(b.date)),
        };
      }
    }

    // Luỹ kế 12 tháng của năm nay và năm trước, để thấy đang đi nhanh hay chậm
    // hơn chính mình năm ngoái.
    let cumThis = 0;
    let cumLast = 0;
    const cumulative = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      cumThis += monthlyCum.get(`${year}-${m}`) || 0;
      cumLast += monthlyCum.get(`${year - 1}-${m}`) || 0;
      return {
        name: m,
        // Tháng chưa tới thì để trống thay vì kẻ một đường ngang giả.
        thisYear: i + 1 <= monthNum ? cumThis : null,
        lastYear: cumLast,
      };
    });

    // Trung bình theo tháng trong năm, gộp mọi năm có dữ liệu — nhìn ra mùa vụ.
    const byCalendarMonth = Array.from({ length: 12 }, () => ({ total: 0, years: new Set<number>() }));
    for (const [k, v] of monthlyCum.entries()) {
      const idx = Number(k.slice(5, 7)) - 1;
      byCalendarMonth[idx].total += v;
      byCalendarMonth[idx].years.add(Number(k.slice(0, 4)));
    }
    const seasonality = byCalendarMonth.map((v, i) => ({
      name: String(i + 1).padStart(2, "0"),
      avg: v.years.size > 0 ? Math.round(v.total / v.years.size) : 0,
    }));

    const shareOfTotal = monthKeys.map((name) => {
      const all = allByMonth.get(name) || 0;
      const mine = series.get(name)!.amount;
      return { name, pct: all > 0 ? Math.round((mine / all) * 100) : 0 };
    });

    const nowKey = monthKey(new Date());
    const missingMonths = monthKeys
      .slice(-12)
      .filter((m) => (series.get(m)?.amount || 0) === 0 && m !== nowKey);

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
        subNames: subNames.map((s) => s || "__none"),
        details,
        cumulative,
        seasonality,
        shareOfTotal,
        sizeBuckets: SIZE_BUCKETS.map((b, i) => ({
          name: b.label,
          count: sizeCounts[i].count,
          amount: sizeCounts[i].amount,
        })),
        weekday: WEEKDAYS.map((w, i) => ({
          name: w,
          amount: weekday[i].amount,
          count: weekday[i].count,
        })),
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
