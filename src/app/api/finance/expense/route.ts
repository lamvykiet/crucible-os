export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function classify(type: string) {
  const t = type?.trim().toLowerCase();
  return t === "expense" || t === "refund" ? t : "ignored";
}

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const requested = searchParams.get("month");
    const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : now.toISOString().slice(0, 7);
    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    if (!Number.isInteger(year) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json({ success: false, error: "Invalid month format" }, { status: 400 });
    }

    const userId = user.id;
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNum, 1));
    const ytdStart = new Date(Date.UTC(year, monthNum - 12, 1));
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const [monthTx, ytdTx, yearTx] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: startDate, lt: endDate } },
        orderBy: { date: "asc" },
        // Chỉ lấy id của dòng hàng, đủ để biết giao dịch có chi tiết hay chưa.
        include: { items: { select: { id: true } } },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: ytdStart, lt: endDate } },
        // `categoryGroup` để dựng cột chồng 12 tháng — tổng tháng không nói
        // được tiền đi vào nhóm nào.
        select: { date: true, type: true, totalAmount: true, categoryGroup: true },
        orderBy: { date: "asc" },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: yearStart, lt: yearEnd } },
        select: { date: true, type: true, totalAmount: true, categoryGroup: true },
      }),
    ]);

    let grossExpense = 0;
    let refunds = 0;
    const expenseByCategory = new Map<string, number>();
    const expenseBySupplier = new Map<string, number>();

    for (const t of monthTx) {
      const b = classify(t.type);
      if (b === "expense") {
        grossExpense += t.totalAmount;
        expenseByCategory.set(t.categoryGroup || "Other", (expenseByCategory.get(t.categoryGroup || "Other") || 0) + t.totalAmount);
        if (t.supplier) {
          expenseBySupplier.set(t.supplier, (expenseBySupplier.get(t.supplier) || 0) + t.totalAmount);
        }
      } else if (b === "refund") {
        refunds += t.totalAmount;
        expenseByCategory.set(t.categoryGroup || "Other", (expenseByCategory.get(t.categoryGroup || "Other") || 0) - t.totalAmount);
        if (t.supplier) {
          expenseBySupplier.set(t.supplier, (expenseBySupplier.get(t.supplier) || 0) - t.totalAmount);
        }
      }
    }

    const monthlyExpense = grossExpense - refunds;
    const isCurrentMonth = now.getUTCFullYear() === year && now.getUTCMonth() === monthNum - 1;
    const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    const elapsedDays = isCurrentMonth ? now.getUTCDate() : daysInMonth;

    const avgDailyExpense = elapsedDays > 0 ? Math.round(monthlyExpense / elapsedDays) : 0;
    const eomForecast = avgDailyExpense * daysInMonth;

    const categoryBreakdown = [...expenseByCategory.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
      
    const topMerchants = [...expenseBySupplier.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .filter((m) => m.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const perDay = new Array<number>(daysInMonth).fill(0);
    for (const t of monthTx) {
      const idx = t.date.getUTCDate() - 1;
      if (idx < 0 || idx >= daysInMonth) continue;
      const b = classify(t.type);
      if (b === "expense") perDay[idx] += t.totalAmount;
      else if (b === "refund") perDay[idx] -= t.totalAmount;
    }
    const visibleDays = isCurrentMonth ? elapsedDays : daysInMonth;
    const dailySeries = perDay.slice(0, visibleDays).map((amount, i) => ({
      name: String(i + 1).padStart(2, "0"),
      amount,
    }));

    const ytdMap = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      ytdMap.set(monthKey(new Date(Date.UTC(year, monthNum - 1 - i, 1))), 0);
    }
    for (const t of ytdTx) {
      const key = monthKey(t.date);
      if (!ytdMap.has(key)) continue;
      const b = classify(t.type);
      if (b === "expense") ytdMap.set(key, ytdMap.get(key)! + t.totalAmount);
      else if (b === "refund") ytdMap.set(key, ytdMap.get(key)! - t.totalAmount);
    }
    const monthlySeries = [...ytdMap.entries()].map(([name, amount]) => ({ name, amount }));

    // Tỷ trọng từng nhóm trong mỗi tháng, cho biểu đồ cột chồng 12 tháng.
    // Chỉ có tổng tháng thì không trả lời được "tháng đó tiền đi đâu" — mà đó
    // mới là câu hỏi khi thấy một tháng vọt lên.
    const perMonthCat = new Map<string, Map<string, number>>();
    for (const key of ytdMap.keys()) perMonthCat.set(key, new Map());
    for (const t of ytdTx) {
      const bucket = perMonthCat.get(monthKey(t.date));
      if (!bucket) continue;
      const b = classify(t.type);
      const group = t.categoryGroup || "Other";
      if (b === "expense") bucket.set(group, (bucket.get(group) || 0) + t.totalAmount);
      else if (b === "refund") bucket.set(group, (bucket.get(group) || 0) - t.totalAmount);
    }

    // Bốn nhóm lớn nhất tính trên cả 12 tháng giữ màu riêng; phần đuôi gộp
    // thành một khoá "__other". Chỉ bốn: hệ màu biểu đồ của dự án
    // (--chart-1..6) là một dải ấm nhạt dần, hai bậc cuối gần như trùng nền
    // thẻ nên khúc cột sẽ tàng hình. Bốn bậc đầu mới tách nhau rõ.
    const totalByGroup = new Map<string, number>();
    for (const bucket of perMonthCat.values()) {
      for (const [g, v] of bucket) totalByGroup.set(g, (totalByGroup.get(g) || 0) + v);
    }
    const ranked = [...totalByGroup.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const namedKeys = ranked.slice(0, 4).map(([g]) => g);
    const hasOther = ranked.length > namedKeys.length;
    const OTHER_KEY = "__other";

    const monthlyBreakdown = [...ytdMap.entries()].map(([name, total]) => {
      const bucket = perMonthCat.get(name)!;
      const row: Record<string, string | number> = { name, total };
      for (const k of namedKeys) row[k] = 0;
      let other = 0;
      for (const [g, v] of bucket) {
        if (v <= 0) continue;
        if (namedKeys.includes(g)) row[g] = (row[g] as number) + v;
        else other += v;
      }
      if (hasOther) row[OTHER_KEY] = other;
      return row;
    });
    const monthlyCategoryKeys = hasOther ? [...namedKeys, OTHER_KEY] : namedKeys;

    const recentTransactions = monthTx
      .filter(t => classify(t.type) !== "ignored")
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        date: t.date.toISOString().split('T')[0],
        supplier: t.supplier || 'Unknown',
        amount: classify(t.type) === "expense" ? t.totalAmount : -t.totalAmount,
        category: t.categoryGroup || 'Other',
        subGroup: t.subGroup || '',
        paymentMethod: t.paymentMethod || 'unknown',
        itemCount: t.items.length,
        // Chỗ nào còn trống thì hiện cờ ngay trong danh sách, thay vì bắt người
        // dùng mở từng giao dịch mới biết mình còn thiếu gì.
        missing: {
          subGroup: !t.subGroup,
          paymentMethod: !t.paymentMethod || t.paymentMethod === 'unknown',
          items: t.items.length === 0,
        },
      }));

    // --- Calculate Yearly Breakdown ---
    let yearlyExpense = 0;
    const yearCatMap = new Map<string, number>();
    for (const t of yearTx) {
      const b = classify(t.type);
      if (b === "expense") {
        yearlyExpense += t.totalAmount;
        yearCatMap.set(t.categoryGroup || "Other", (yearCatMap.get(t.categoryGroup || "Other") || 0) + t.totalAmount);
      } else if (b === "refund") {
        yearlyExpense -= t.totalAmount;
        yearCatMap.set(t.categoryGroup || "Other", (yearCatMap.get(t.categoryGroup || "Other") || 0) - t.totalAmount);
      }
    }
    const yearlyCategoryBreakdown = [...yearCatMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // --- Calculate Daily Breakdown (Today or Last Day of Month) ---
    const targetDay = isCurrentMonth ? now.getUTCDate() : daysInMonth;
    let dailyExpense = 0;
    const dayCatMap = new Map<string, number>();
    for (const t of monthTx) {
      if (t.date.getUTCDate() === targetDay) {
        const b = classify(t.type);
        if (b === "expense") {
          dailyExpense += t.totalAmount;
          dayCatMap.set(t.categoryGroup || "Other", (dayCatMap.get(t.categoryGroup || "Other") || 0) + t.totalAmount);
        } else if (b === "refund") {
          dailyExpense -= t.totalAmount;
          dayCatMap.set(t.categoryGroup || "Other", (dayCatMap.get(t.categoryGroup || "Other") || 0) - t.totalAmount);
        }
      }
    }
    const dailyCategoryBreakdown = [...dayCatMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          day: dailyExpense,
          month: monthlyExpense,
          year: yearlyExpense,
        },
        categoryBreakdowns: {
          day: dailyCategoryBreakdown,
          month: categoryBreakdown,
          year: yearlyCategoryBreakdown,
        },
        monthlyExpense, // Keep for backward compatibility if needed temporarily
        avgDailyExpense,
        eomForecast,
        categoriesCount: categoryBreakdown.length,
        categoryBreakdown, // Keep for backward compatibility
        dailySeries,
        monthlySeries,
        monthlyBreakdown,
        monthlyCategoryKeys,
        topMerchants,
        recentTransactions,
        hasData: monthTx.length > 0 || yearTx.length > 0,
      }
    });
  } catch (error) {
    console.error("Expense Data Fetch Error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
