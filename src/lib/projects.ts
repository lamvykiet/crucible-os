// Hiệu quả của một dự án: đã bỏ vào bao nhiêu, thu về bao nhiêu, bao giờ hoà
// vốn.
//
// Mọi con số tính lại từ các `ProjectAllocation` (phần của từng giao dịch thuộc
// dự án) — bảng `Project` không giữ số tổng nào. Route đổi mỗi phân bổ thành
// một `ProjectTx` với `totalAmount` = số tiền ĐÃ PHÂN BỔ, không phải tổng hoá
// đơn: hoá đơn chia 60/40 thì dự án chỉ gánh 60%. Hàm ở đây là hàm thuần để route danh sách lẫn route
// phân tích cùng đếm một kiểu: hai công thức là hai con số khác nhau cho cùng
// một dự án trên hai màn hình.

export const PROJECT_STATUSES = ["active", "paused", "closed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectTx {
  id: string;
  date: Date;
  type: string;
  supplier: string;
  categoryGroup: string;
  subGroup: string | null;
  totalAmount: number;
  /** RAW_MATERIAL | MACHINERY | TESTING | LABOR | OVERHEAD | REVENUE */
  costCategory?: string;
  items?: { productName: string; quantity: number; totalPrice: number }[];
}

/**
 * Giao dịch này làm vốn tăng hay doanh thu tăng, và tăng bao nhiêu.
 *
 * Hoàn tiền (`Refund`) gắn dự án là tiền mua đồ cho dự án được trả lại, nên trừ
 * vào vốn chứ không cộng vào doanh thu — cộng vào doanh thu là tự thổi phồng
 * lợi nhuận bằng chính tiền của mình. Chuyển khoản và điều chỉnh không phải
 * tiền vào hay ra khỏi dự án, bỏ qua.
 */
export function projectEffect(tx: Pick<ProjectTx, "type" | "totalAmount">) {
  const amount = Math.abs(tx.totalAmount || 0);
  if (tx.type === "Expense") return { cost: amount, revenue: 0 };
  if (tx.type === "Refund") return { cost: -amount, revenue: 0 };
  if (tx.type === "Income") return { cost: 0, revenue: amount };
  return { cost: 0, revenue: 0 };
}

const monthOf = (d: Date) => d.toISOString().slice(0, 7);

function nextMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

export function projectTotals(txs: ProjectTx[], budget?: number | null) {
  let cost = 0;
  let revenue = 0;
  let costCount = 0;
  let revenueCount = 0;
  let first: Date | null = null;
  let last: Date | null = null;

  for (const tx of txs) {
    const e = projectEffect(tx);
    if (e.cost === 0 && e.revenue === 0) continue;
    cost += e.cost;
    revenue += e.revenue;
    if (e.cost !== 0) costCount += 1;
    if (e.revenue !== 0) revenueCount += 1;
    if (!first || tx.date < first) first = tx.date;
    if (!last || tx.date > last) last = tx.date;
  }

  const profit = revenue - cost;
  return {
    cost,
    revenue,
    profit,
    /** Lãi ròng trên vốn đã bỏ ra. */
    roiPct: pct(profit, cost),
    /** Doanh thu đã thu về được bao nhiêu phần vốn — 100% là hoà vốn. */
    recoveryPct: pct(revenue, cost),
    /** Biên lợi nhuận trên doanh thu. */
    marginPct: revenue > 0 ? pct(profit, revenue) : null,
    budget: budget ?? null,
    budgetUsedPct: budget ? pct(cost, budget) : null,
    costCount,
    revenueCount,
    firstDate: first ? first.toISOString().slice(0, 10) : null,
    lastDate: last ? last.toISOString().slice(0, 10) : null,
  };
}

/** Bao nhiêu tháng gần nhất dùng để ước ngày hoà vốn. */
const PACE_MONTHS = 3;

export function projectAnalysis(
  txs: ProjectTx[],
  {
    today,
    startDate,
    budget,
  }: { today: string; startDate?: Date | null; budget?: number | null }
) {
  const totals = projectTotals(txs, budget);

  // --- Theo tháng --------------------------------------------------------
  // Chạy liền từ tháng bắt đầu tới tháng này, kể cả tháng trống: tháng không
  // thu không chi cũng là thông tin (xưởng đứng máy), bỏ đi là biểu đồ nói dối.
  const byMonth = new Map<string, { cost: number; revenue: number }>();
  for (const tx of txs) {
    const e = projectEffect(tx);
    if (e.cost === 0 && e.revenue === 0) continue;
    const key = monthOf(tx.date);
    const row = byMonth.get(key) ?? { cost: 0, revenue: 0 };
    row.cost += e.cost;
    row.revenue += e.revenue;
    byMonth.set(key, row);
  }

  const keys = [...byMonth.keys()].sort();
  const thisMonth = today.slice(0, 7);
  const firstKey = [keys[0], startDate ? monthOf(startDate) : undefined]
    .filter((k): k is string => !!k)
    .sort()[0];
  const lastKey = [keys[keys.length - 1], thisMonth].filter(Boolean).sort().reverse()[0];

  const monthly: {
    name: string;
    cost: number;
    revenue: number;
    profit: number;
    cumCost: number;
    cumRevenue: number;
    cumProfit: number;
  }[] = [];

  if (firstKey) {
    let cumCost = 0;
    let cumRevenue = 0;
    // Chặn vòng lặp vô hạn nếu dữ liệu ngày tháng hỏng: 50 năm là quá đủ.
    for (let key = firstKey, guard = 0; key <= lastKey && guard < 600; key = nextMonth(key), guard++) {
      const row = byMonth.get(key) ?? { cost: 0, revenue: 0 };
      cumCost += row.cost;
      cumRevenue += row.revenue;
      monthly.push({
        name: key,
        cost: row.cost,
        revenue: row.revenue,
        profit: row.revenue - row.cost,
        cumCost,
        cumRevenue,
        cumProfit: cumRevenue - cumCost,
      });
    }
  }

  // --- Hoà vốn -----------------------------------------------------------
  // "Đã hoà vốn từ tháng X" = tháng đầu tiên mà từ đó trở đi lãi luỹ kế không
  // âm nữa. Lấy tháng đầu tiên chạm 0 thì sai khi dự án hoà vốn rồi lại lỗ.
  let reachedMonth: string | null = null;
  if (totals.cost > 0 && totals.profit >= 0) {
    for (let i = monthly.length - 1; i >= 0; i--) {
      if (monthly[i].cumProfit < 0) break;
      reachedMonth = monthly[i].name;
    }
  }

  // Ước còn bao lâu nữa: chỉ dựa vào nhịp lãi của vài tháng gần nhất, và chỉ
  // khi nhịp đó dương. Lãi âm hay bằng 0 thì nói thẳng là chưa ước được,
  // không bịa ra một con số.
  const recent = monthly.slice(-PACE_MONTHS);
  const avgMonthlyProfit =
    recent.length > 0
      ? Math.round(recent.reduce((s, m) => s + m.profit, 0) / recent.length)
      : 0;
  const shortfall = totals.profit < 0 ? -totals.profit : 0;
  const monthsToGo =
    shortfall > 0 && avgMonthlyProfit > 0 ? Math.ceil(shortfall / avgMonthlyProfit) : null;

  // --- Vốn đi đâu --------------------------------------------------------
  const costMap = new Map<string, { group: string; subGroup: string | null; amount: number; count: number }>();
  const sourceMap = new Map<string, { name: string; amount: number; count: number }>();
  const itemMap = new Map<string, { name: string; amount: number; quantity: number; count: number }>();
  const byCostCategory: Record<string, number> = {};

  for (const tx of txs) {
    const e = projectEffect(tx);
    if (e.cost !== 0) {
      const key = `${tx.categoryGroup}::${tx.subGroup ?? ""}`;
      const row = costMap.get(key) ?? {
        group: tx.categoryGroup,
        subGroup: tx.subGroup,
        amount: 0,
        count: 0,
      };
      row.amount += e.cost;
      row.count += 1;
      costMap.set(key, row);
      const cc = tx.costCategory ?? "RAW_MATERIAL";
      byCostCategory[cc] = (byCostCategory[cc] ?? 0) + e.cost;

      // Món đã mua cho dự án, gộp theo tên. Chỉ tính khoản chi (không tính
      // hoàn tiền) để "mua gì nhiều nhất" không bị trừ ngược.
      if (tx.type === "Expense") {
        for (const it of tx.items ?? []) {
          const name = it.productName.trim();
          if (!name) continue;
          const k = name.toLowerCase();
          const item = itemMap.get(k) ?? { name, amount: 0, quantity: 0, count: 0 };
          item.amount += it.totalPrice || 0;
          item.quantity += it.quantity || 0;
          item.count += 1;
          itemMap.set(k, item);
        }
      }
    }
    if (e.revenue !== 0) {
      const name = tx.supplier?.trim() || "N/A";
      const row = sourceMap.get(name.toLowerCase()) ?? { name, amount: 0, count: 0 };
      row.amount += e.revenue;
      row.count += 1;
      sourceMap.set(name.toLowerCase(), row);
    }
  }

  const byAmount = <T extends { amount: number }>(a: T, b: T) => b.amount - a.amount;

  return {
    totals,
    breakEven: {
      reachedMonth,
      shortfall,
      avgMonthlyProfit,
      paceMonths: recent.length,
      monthsToGo,
    },
    monthly,
    costByCategory: [...costMap.values()].filter((r) => r.amount !== 0).sort(byAmount),
    revenueBySource: [...sourceMap.values()].sort(byAmount),
    /** Chi phí theo năm nhóm (vật tư, máy, kiểm thử, nhân công, khác). */
    byCostCategory,
    topItems: [...itemMap.values()].sort(byAmount).slice(0, 8),
  };
}
