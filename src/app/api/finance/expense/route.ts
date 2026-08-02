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
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: ytdStart, lt: endDate } },
        select: { date: true, type: true, totalAmount: true },
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

    const recentTransactions = monthTx
      .filter(t => classify(t.type) !== "ignored")
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        date: t.date.toISOString().split('T')[0],
        supplier: t.supplier || 'Unknown',
        amount: classify(t.type) === "expense" ? t.totalAmount : -t.totalAmount,
        category: t.categoryGroup || 'Other'
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
