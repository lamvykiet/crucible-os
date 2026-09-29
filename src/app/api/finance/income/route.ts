export const dynamic = 'force-dynamic';
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

    // --- So sánh giữa các nguồn thu ---
    //
    // Danh sách tỷ trọng ở trên chỉ trả lời "nguồn nào to nhất năm nay". Ba câu
    // còn thiếu mới là ba câu đáng hỏi: nguồn này năm ngoái thế nào, nó trả đều
    // hay thất thường, và nếu mất nó thì còn lại bao nhiêu.
    //
    // Nguồn năm ngoái có mà năm nay mất hẳn cũng phải nằm trong danh sách —
    // chỗ hụt đi là thứ dễ bỏ sót nhất, vì nó không còn dòng nào để nhìn thấy.
    const prevSupplierMap = new Map<string, number>();
    for (const t of prevYear) {
      const key = t.supplier?.trim() || "Không rõ";
      prevSupplierMap.set(key, (prevSupplierMap.get(key) || 0) + t.totalAmount);
    }

    const monthsBySupplier = new Map<string, Set<string>>();
    const countBySupplier = new Map<string, number>();
    const lastMonthBySupplier = new Map<string, string>();
    for (const t of thisYear) {
      const key = t.supplier?.trim() || "Không rõ";
      const k = monthKey(t.date);
      if (!monthsBySupplier.has(key)) monthsBySupplier.set(key, new Set());
      monthsBySupplier.get(key)!.add(k);
      countBySupplier.set(key, (countBySupplier.get(key) || 0) + 1);
      const last = lastMonthBySupplier.get(key);
      if (!last || k > last) lastMonthBySupplier.set(key, k);
    }

    const sourceNames = new Set<string>([
      ...supplierMap.keys(),
      ...prevSupplierMap.keys(),
    ]);
    const sourceComparison = [...sourceNames]
      .map((name) => {
        const amount = supplierMap.get(name) || 0;
        const prevAmount = prevSupplierMap.get(name) || 0;
        const months = monthsBySupplier.get(name)?.size || 0;
        return {
          name,
          amount,
          prevAmount,
          share: yearTotal > 0 ? Math.round((amount / yearTotal) * 100) : 0,
          delta: amount - prevAmount,
          // `null` nghĩa là năm ngoái bằng 0 — không chia được, và cũng không
          // phải "tăng 100%": nó là nguồn mới.
          pct:
            prevAmount > 0
              ? Math.round(((amount - prevAmount) / prevAmount) * 100)
              : null,
          months,
          count: countBySupplier.get(name) || 0,
          avgPerActiveMonth: months > 0 ? Math.round(amount / months) : 0,
          lastMonth: lastMonthBySupplier.get(name) || null,
        };
      })
      .sort((a, b) => b.amount - a.amount || b.prevAmount - a.prevAmount);

    // Mức độ phụ thuộc. "Mất nguồn lớn nhất thì còn lại bao nhiêu" là cách nói
    // thẳng nhất về rủi ro, thẳng hơn mọi chỉ số tập trung.
    const topAmount = bySupplier[0]?.amount || 0;
    const concentration = {
      sourceCount: bySupplier.length,
      topShare: bySupplier[0]?.share || 0,
      topTwoShare: yearTotal > 0
        ? Math.round(
            ((bySupplier[0]?.amount || 0) + (bySupplier[1]?.amount || 0)) / yearTotal * 100
          )
        : 0,
      withoutTop: yearTotal - topAmount,
    };

    // Tỷ trọng nguồn theo từng tháng, dùng chung cửa sổ 12 tháng với
    // `monthlySeries` để hai biểu đồ đọc cùng một trục thời gian.
    const topNames = bySupplier.slice(0, 4).map((s) => s.name);
    const OTHER_KEY = "__other";
    const sourceKeys = [...topNames, OTHER_KEY];
    const sourceMonthly = [...seriesMap.entries()].map(([name, total]) => {
      const row: Record<string, string | number> = { name, total };
      for (const k of sourceKeys) row[k] = 0;
      return row;
    });
    const rowByMonth = new Map(
      sourceMonthly.map((r) => [r.name as string, r] as const)
    );
    for (const t of incomes) {
      const row = rowByMonth.get(monthKey(t.date));
      if (!row) continue;
      const src = t.supplier?.trim() || "Không rõ";
      const key = topNames.includes(src) ? src : OTHER_KEY;
      row[key] = (row[key] as number) + t.totalAmount;
    }
    // Không có nguồn nào rơi vào "Khác" thì bỏ hẳn cột đó đi, đừng vẽ một dải
    // trống rồi bắt người đọc đoán.
    const otherUsed = sourceMonthly.some((r) => (r[OTHER_KEY] as number) > 0);
    if (!otherUsed) {
      for (const row of sourceMonthly) delete row[OTHER_KEY];
    }

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
        sourceComparison,
        concentration,
        sourceMonthly,
        sourceKeys: otherUsed ? sourceKeys : topNames,
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
