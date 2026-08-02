import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Cấp số liệu thật cho tab Income. Trước đây toàn bộ tab này chạy trên 4 mảng
// hardcode (monthlyIncomeData, yearlyData, annualComparison, companyComparison),
// kể cả tên công ty và các ô "Nguồn thu lớn nhất" / "Tháng cao nhất".

function isIncome(type: string) {
  return type?.trim().toLowerCase() === "income";
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

    const monthParam = searchParams.get("month");
    const month =
      monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? monthParam
        : now.toISOString().slice(0, 7);

    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    if (!Number.isInteger(year) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { success: false, error: "Tham số `month` phải có dạng YYYY-MM" },
        { status: 400 }
      );
    }

    const userId = user.id;

    // Lấy toàn bộ giao dịch thu nhập một lần rồi gộp bằng JS. Ở quy mô hiện tại
    // (vài trăm dòng) đây là phương án đơn giản và chính xác nhất. Nếu dữ liệu
    // lớn lên, đổi sang $queryRaw + date_trunc để Postgres gộp.
    const all = await prisma.transaction.findMany({
      where: { userId },
      select: { date: true, type: true, totalAmount: true, supplier: true },
      orderBy: { date: "asc" },
    });
    const incomes = all.filter((t) => isIncome(t.type));

    // --- Thu nhập tháng đang chọn ---
    const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
    const monthEnd = new Date(Date.UTC(year, monthNum, 1));
    const monthlyIncome = incomes
      .filter((t) => t.date >= monthStart && t.date < monthEnd)
      .reduce((s, t) => s + t.totalAmount, 0);

    // --- Chuỗi 12 tháng gần nhất tính tới tháng đang chọn ---
    const seriesMap = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      seriesMap.set(monthKey(new Date(Date.UTC(year, monthNum - 1 - i, 1))), 0);
    }
    for (const t of incomes) {
      const k = monthKey(t.date);
      if (seriesMap.has(k)) seriesMap.set(k, seriesMap.get(k)! + t.totalAmount);
    }
    const monthlySeries = [...seriesMap.entries()].map(([name, amount]) => ({
      name,
      amount,
    }));

    // --- Tổng theo năm (mọi năm có dữ liệu) ---
    const byYear = new Map<number, number>();
    for (const t of incomes) {
      const y = t.date.getUTCFullYear();
      byYear.set(y, (byYear.get(y) || 0) + t.totalAmount);
    }
    const annualTotals = [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([y, amount]) => ({ name: String(y), amount }));

    // --- Phân tích trong năm đang chọn ---
    const thisYear = incomes.filter((t) => t.date.getUTCFullYear() === year);
    const prevYear = incomes.filter((t) => t.date.getUTCFullYear() === year - 1);

    const yearTotal = thisYear.reduce((s, t) => s + t.totalAmount, 0);
    const prevYearTotal = prevYear.reduce((s, t) => s + t.totalAmount, 0);

    // Chia trung bình cho số tháng THỰC SỰ có thu nhập, không phải 12 —
    // chia cho 12 ở năm mới bắt đầu sẽ ra con số vô nghĩa.
    const monthsWithIncome = new Set(thisYear.map((t) => monthKey(t.date))).size;
    const prevMonthsWithIncome = new Set(prevYear.map((t) => monthKey(t.date))).size;
    const avgPerMonth = monthsWithIncome > 0 ? Math.round(yearTotal / monthsWithIncome) : 0;
    const prevAvgPerMonth =
      prevMonthsWithIncome > 0 ? Math.round(prevYearTotal / prevMonthsWithIncome) : 0;

    // Tháng cao/thấp nhất trong năm — chỉ xét tháng có phát sinh thu nhập.
    const yearByMonth = new Map<string, number>();
    for (const t of thisYear) {
      const k = monthKey(t.date);
      yearByMonth.set(k, (yearByMonth.get(k) || 0) + t.totalAmount);
    }
    const monthEntries = [...yearByMonth.entries()].filter(([, v]) => v > 0);
    monthEntries.sort((a, b) => b[1] - a[1]);
    const highestMonth = monthEntries[0]
      ? { month: monthEntries[0][0], amount: monthEntries[0][1] }
      : null;
    const lowestMonth = monthEntries[monthEntries.length - 1]
      ? {
          month: monthEntries[monthEntries.length - 1][0],
          amount: monthEntries[monthEntries.length - 1][1],
        }
      : null;

    // Nguồn thu theo `supplier` trong năm đang chọn.
    const supplierMap = new Map<string, number>();
    for (const t of thisYear) {
      const key = t.supplier?.trim() || "Không rõ";
      supplierMap.set(key, (supplierMap.get(key) || 0) + t.totalAmount);
    }
    const bySupplier = [...supplierMap.entries()]
      .map(([name, amount]) => ({
        name,
        amount,
        share: yearTotal > 0 ? Math.round((amount / yearTotal) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      success: true,
      data: {
        month,
        year,
        monthlyIncome,
        monthlySeries,
        annualTotals,
        yearTotal,
        prevYearTotal,
        avgPerMonth,
        prevAvgPerMonth,
        monthsWithIncome,
        highestMonth,
        lowestMonth,
        bySupplier,
        largestSource: bySupplier[0] || null,
        hasData: incomes.length > 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Income Data Fetch Error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
