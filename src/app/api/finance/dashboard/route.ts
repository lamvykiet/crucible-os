export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Mọi mốc thời gian đều tính bằng UTC.
//
// Bản cũ dùng `new Date(year, monthNum - 1, 1)` — hàm tạo này diễn giải tham số
// theo timezone của MÁY CHỦ, trong khi Postgres lưu timestamp ở UTC. Hệ quả là
// cùng một tháng cho ra kết quả khác nhau tuỳ nơi deploy: máy VN (UTC+7), Vercel
// (UTC), hay server múi giờ âm sẽ đưa giao dịch ngày đầu/cuối tháng vào các
// tháng khác nhau. Dùng Date.UTC làm kết quả tất định ở mọi môi trường.

type Bucket = "income" | "expense" | "refund" | "ignored";

/**
 * Schema cho phép 5 giá trị `type`: Income | Expense | Transfer | Refund | Adjustment.
 * Bản cũ chỉ xử lý 2 giá trị đầu và âm thầm bỏ qua phần còn lại.
 *
 * - Transfer: chuyển tiền giữa các ví của chính mình, không phải thu cũng không
 *   phải chi — tính vào sẽ thổi phồng cả hai đầu.
 * - Refund: tiền hoàn, phải TRỪ khỏi chi tiêu chứ không cộng vào thu nhập.
 * - Adjustment: bút toán điều chỉnh, ý nghĩa phụ thuộc nghiệp vụ nên tạm bỏ qua
 *   và báo cáo riêng ở `unclassified` để không biến mất trong im lặng.
 */
function classify(type: string): Bucket {
  switch (type?.trim().toLowerCase()) {
    case "income":
      return "income";
    case "expense":
      return "expense";
    case "refund":
      return "refund";
    case "transfer":
    case "adjustment":
      return "ignored";
    default:
      return "ignored";
  }
}

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

/** Trung bình trượt 7 phiên, tính trên các ngày đã trôi qua. */
function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = values.slice(from, i + 1);
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
  });
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const requested = searchParams.get("month");
    const month =
      requested && /^\d{4}-\d{2}$/.test(requested)
        ? requested
        : now.toISOString().slice(0, 7);

    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(monthNum) ||
      monthNum < 1 ||
      monthNum > 12
    ) {
      return NextResponse.json(
        { success: false, error: "Tham số `month` phải có dạng YYYY-MM" },
        { status: 400 }
      );
    }

    const userId = user.id;

    // [startDate, endDate) — nửa mở, tránh phải bịa ra 23:59:59.999.
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNum, 1));

    // Cửa sổ 12 tháng kết thúc ở tháng đang xem, dùng cho biểu đồ YTD.
    const ytdStart = new Date(Date.UTC(year, monthNum - 12, 1));

    const [monthTx, ytdTx, budgets, latestTx] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: startDate, lt: endDate } },
        orderBy: { date: "asc" },
      }),
      // Dữ liệu hiện ở quy mô vài trăm dòng nên gộp bằng JS là đủ. Nếu sau này
      // lớn lên, thay bằng $queryRaw + date_trunc('month', date) để Postgres gộp.
      prisma.transaction.findMany({
        where: { userId, date: { gte: ytdStart, lt: endDate } },
        select: { date: true, type: true, totalAmount: true },
        orderBy: { date: "asc" },
      }),
      prisma.budget.findMany({
        where: { userId, period: month },
      }),
      prisma.transaction.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
    ]);

    // ---- Tổng hợp tháng ----
    let monthlyIncome = 0;
    let grossExpense = 0;
    let refunds = 0;
    const unclassified = new Map<string, number>();

    const expenseByCategory = new Map<string, number>();

    for (const t of monthTx) {
      switch (classify(t.type)) {
        case "income":
          monthlyIncome += t.totalAmount;
          break;
        case "expense":
          grossExpense += t.totalAmount;
          expenseByCategory.set(
            t.categoryGroup || "Khác",
            (expenseByCategory.get(t.categoryGroup || "Khác") || 0) + t.totalAmount
          );
          break;
        case "refund":
          refunds += t.totalAmount;
          expenseByCategory.set(
            t.categoryGroup || "Khác",
            (expenseByCategory.get(t.categoryGroup || "Khác") || 0) - t.totalAmount
          );
          break;
        case "ignored":
          unclassified.set(t.type, (unclassified.get(t.type) || 0) + 1);
          break;
      }
    }

    // Tiền hoàn làm giảm chi tiêu thực.
    const monthlyExpense = grossExpense - refunds;
    const netCashFlow = monthlyIncome - monthlyExpense;

    // KHÔNG kẹp về 0 khi âm. Bản cũ làm vậy khiến tháng bội chi vẫn hiện 0%,
    // che đúng cái đáng ra phải cảnh báo.
    const savingsRate =
      monthlyIncome > 0 ? Math.round((netCashFlow / monthlyIncome) * 100) : 0;

    // ---- Mốc "hôm nay" ----
    const isCurrentMonth =
      now.getUTCFullYear() === year && now.getUTCMonth() === monthNum - 1;
    const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
    const elapsedDays = isCurrentMonth ? now.getUTCDate() : daysInMonth;

    const todayStart = isCurrentMonth
      ? new Date(Date.UTC(year, monthNum - 1, now.getUTCDate()))
      : new Date(Date.UTC(year, monthNum - 1, daysInMonth));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    let dailyIncome = 0;
    let dailyExpense = 0;
    for (const t of monthTx) {
      if (t.date < todayStart || t.date >= todayEnd) continue;
      const b = classify(t.type);
      if (b === "income") dailyIncome += t.totalAmount;
      else if (b === "expense") dailyExpense += t.totalAmount;
      else if (b === "refund") dailyExpense -= t.totalAmount;
    }
    const dailyCashFlow = dailyIncome - dailyExpense;

    const avgDailyExpense =
      elapsedDays > 0 ? Math.round(monthlyExpense / elapsedDays) : 0;
    const eomForecast = avgDailyExpense * daysInMonth;

    // ---- Chuỗi theo ngày (thay mảng dailyData hardcode ở client) ----
    const perDay = new Array<number>(daysInMonth).fill(0);
    for (const t of monthTx) {
      const idx = t.date.getUTCDate() - 1;
      if (idx < 0 || idx >= daysInMonth) continue;
      const b = classify(t.type);
      if (b === "expense") perDay[idx] += t.totalAmount;
      else if (b === "refund") perDay[idx] -= t.totalAmount;
    }
    // Với tháng hiện tại, cắt ở hôm nay — kéo dài tới cuối tháng chỉ tạo ra một
    // chuỗi số 0 giả và kéo tụt đường trung bình trượt.
    const visibleDays = isCurrentMonth ? elapsedDays : daysInMonth;
    const expenseSeries = perDay.slice(0, visibleDays);
    const ma7 = movingAverage(expenseSeries, 7);
    const dailySeries = expenseSeries.map((expense, i) => ({
      name: String(i + 1).padStart(2, "0"),
      expense,
      ma7: ma7[i],
    }));

    // ---- Chuỗi 12 tháng (thay mảng ytdData hardcode) ----
    const ytdMap = new Map<string, { income: number; expense: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(year, monthNum - 1 - i, 1));
      ytdMap.set(monthKey(d), { income: 0, expense: 0 });
    }
    for (const t of ytdTx) {
      const key = monthKey(t.date);
      const entry = ytdMap.get(key);
      if (!entry) continue;
      const b = classify(t.type);
      if (b === "income") entry.income += t.totalAmount;
      else if (b === "expense") entry.expense += t.totalAmount;
      else if (b === "refund") entry.expense -= t.totalAmount;
    }
    let cumIncome = 0;
    let cumExpense = 0;
    const ytdSeries = [...ytdMap.entries()].map(([name, v]) => {
      cumIncome += v.income;
      cumExpense += v.expense;
      return {
        name,
        income: v.income,
        expense: v.expense,
        cumulativeIncome: cumIncome,
        cumulativeExpense: cumExpense,
      };
    });

    // ---- Phân bổ chi tiêu theo nhóm ----
    const categoryBreakdown = [...expenseByCategory.entries()]
      .map(([group, amount]) => ({ group, amount }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    // ---- Ngân sách vs Thực chi ----
    // Bản cũ hoàn toàn không truy vấn bảng Budget nên ô BvA vĩnh viễn hiện "—".
    const monthlyBudgets = budgets.filter(
      (b) => b.periodType?.toLowerCase() === "monthly"
    );
    const budgetVsActual = monthlyBudgets.map((b) => {
      const actual = expenseByCategory.get(b.categoryGroup) || 0;
      return {
        group: b.categoryGroup,
        budget: b.amount,
        actual,
        remaining: b.amount - actual,
      };
    });
    const totalBudget = monthlyBudgets.reduce((s, b) => s + b.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        month,
        // Tương thích ngược với DashboardTab hiện tại
        monthlyIncome,
        monthlyExpense,
        netCashFlow,
        savingsRate,
        dailyIncome,
        dailyExpense,
        dailyCashFlow,
        avgDailyExpense,
        eomForecast,

        // Số liệu mới thay cho mảng hardcode ở client
        dailySeries,
        ytdSeries,
        categoryBreakdown,
        budgetVsActual,
        totalBudget,
        totalActualExpense: monthlyExpense,

        // Bối cảnh để UI phân biệt "chưa có dữ liệu" với "thật sự bằng 0"
        transactionCount: monthTx.length,
        hasData: monthTx.length > 0,
        latestMonthWithData: latestTx ? monthKey(latestTx.date) : null,
        elapsedDays,
        daysInMonth,

        // Các `type` không xếp được vào thu/chi — hiện ra thay vì bỏ qua im lặng
        unclassified: [...unclassified.entries()].map(([type, count]) => ({
          type,
          count,
        })),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Dashboard Data Fetch Error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
  // Không gọi prisma.$disconnect() — pool được dùng chung, xem src/lib/prisma.ts
}
