// Ngân sách: số thực chi so với ngân sách, theo tháng và theo năm.
//
// Chỉ có MỘT bản công thức, đặt ở đây — `api/finance/budgets` và
// `api/finance/dashboard` cùng đọc qua đây. Tính lại ở nơi khác là hai con số
// khác nhau trên cùng một màn hình (bài học đã ghi ở AGENTS.md, phần chuỗi ngày
// của Thói quen). File này KHÔNG import prisma hay React để kiểm được bằng node.
//
// QUY ƯỚC
//
//   • Mỗi dòng `Budget` là ngân sách của MỘT nhóm trong MỘT tháng. Sửa ngân sách
//     tháng 12 không đụng tháng 11 — đó là cách giữ lịch sử để đánh giá lại.
//   • `kind = "expense"`: so với CHI = Expense trừ Refund, cộng phần TRẢ GỐC nợ
//     (Transaction.source = "debt") của đúng nhóm đó. Ngân sách nhóm nợ đặt bằng
//     cả kỳ trả (gốc + lãi); chỉ so với phần lãi thì tháng nào cũng hiện dùng
//     chưa tới một nửa. Các nhóm khác không có dòng trả gốc nên không đổi.
//   • `kind = "income"`: so với THU = Income. Refund trừ vào chi, không cộng vào
//     doanh thu; Transfer / Adjustment không phải thu.
//   • Mọi mốc tháng tính theo UTC, cùng quy ước với `Transaction.date`.

export type BudgetKind = "expense" | "income";

export const BUDGET_KINDS: BudgetKind[] = ["expense", "income"];

export function isBudgetKind(v: unknown): v is BudgetKind {
  return v === "expense" || v === "income";
}

/** `Category.kind` → `Budget.kind`. Loại khác (transaction_type) không có ngân sách. */
export function budgetKindOfCategory(categoryKind: string): BudgetKind | null {
  if (categoryKind === "expense_group") return "expense";
  if (categoryKind === "income_group") return "income";
  return null;
}

/** Ngược lại: loại ngân sách → loại danh mục mà nó khớp tên. */
export function categoryKindOfBudget(kind: BudgetKind): "expense_group" | "income_group" {
  return kind === "expense" ? "expense_group" : "income_group";
}

export interface TxLike {
  date: Date;
  type: string;
  totalAmount: number;
  categoryGroup: string;
  source?: string | null;
}

export interface BudgetLike {
  period: string; // YYYY-MM
  categoryGroup: string;
  amount: number;
}

// ---------------------------------------------------------------------------
// Tháng
// ---------------------------------------------------------------------------

export const isMonthKey = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}$/.test(s)) return false;
  const m = Number(s.slice(5, 7));
  return m >= 1 && m <= 12;
};

export const isYearKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}$/.test(s);

export const monthKeyOf = (d: Date) => d.toISOString().slice(0, 7);

/** Dời `delta` tháng: shiftMonth("2026-01", -1) = "2025-12". */
export function shiftMonth(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}

/** 12 khoá tháng của một năm. */
export const monthsOfYear = (year: string): string[] =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

// ---------------------------------------------------------------------------
// Thực tế
// ---------------------------------------------------------------------------

type Bucket = "income" | "expense" | "refund" | "ignored";

/** Cùng bảng phân loại với `api/finance/dashboard`: Transfer/Adjustment không phải thu hay chi. */
export function classifyTx(type: string): Bucket {
  switch (type?.trim().toLowerCase()) {
    case "income":
      return "income";
    case "expense":
      return "expense";
    case "refund":
      return "refund";
    default:
      return "ignored";
  }
}

/**
 * Số thực tế theo nhóm cho một danh sách giao dịch (đã lọc sẵn theo kỳ).
 * Xem quy ước ở đầu file.
 */
export function actualsByGroup(txs: TxLike[], kind: BudgetKind): Map<string, number> {
  const out = new Map<string, number>();
  const add = (g: string, v: number) => {
    const key = g || "Khác";
    out.set(key, (out.get(key) || 0) + v);
  };
  for (const t of txs) {
    const b = classifyTx(t.type);
    if (kind === "income") {
      if (b === "income") add(t.categoryGroup, t.totalAmount);
    } else if (b === "expense") {
      add(t.categoryGroup, t.totalAmount);
    } else if (b === "refund") {
      add(t.categoryGroup, -t.totalAmount);
    } else if (b === "ignored" && t.source === "debt") {
      // Trả gốc do lịch trả nợ sinh ra: tiền rời tài khoản, thuộc ngân sách nhóm nợ.
      add(t.categoryGroup, t.totalAmount);
    }
  }
  return out;
}

/** Thực tế theo (tháng → nhóm), cho đánh giá năm. */
export function actualsByMonth(txs: TxLike[], kind: BudgetKind): Map<string, Map<string, number>> {
  const byMonth = new Map<string, TxLike[]>();
  for (const t of txs) {
    const k = monthKeyOf(t.date);
    const list = byMonth.get(k);
    if (list) list.push(t);
    else byMonth.set(k, [t]);
  }
  const out = new Map<string, Map<string, number>>();
  for (const [k, list] of byMonth) out.set(k, actualsByGroup(list, kind));
  return out;
}

// ---------------------------------------------------------------------------
// Đánh giá một nhóm
// ---------------------------------------------------------------------------

/**
 * Mức dùng của một ô.
 *   chi:  ok (<85%) · near (85–100%) · over (>100%) · none (chưa đặt ngân sách)
 *   thu:  ok (<100%, còn thiếu mục tiêu) · hit (>=100%, đạt) · none
 */
export type BudgetLevel = "none" | "ok" | "near" | "over" | "hit";

export const NEAR_THRESHOLD = 0.85;

export function levelOf(kind: BudgetKind, budget: number, actual: number): BudgetLevel {
  if (budget <= 0) return "none";
  const f = actual / budget;
  if (kind === "income") return f >= 1 ? "hit" : "ok";
  if (f > 1) return "over";
  if (f >= NEAR_THRESHOLD) return "near";
  return "ok";
}

/** Phần trăm làm tròn; `null` khi chưa có ngân sách (chia cho 0 là vô nghĩa). */
export const pctOf = (actual: number, budget: number): number | null =>
  budget > 0 ? Math.round((actual / budget) * 100) : null;

export interface GroupEval {
  group: string;
  budget: number;
  actual: number;
  /** budget − actual (âm = vượt với chi, = còn thiếu với thu thì dương). */
  remaining: number;
  pct: number | null;
  level: BudgetLevel;
  /** Có chi/thu nhưng nhóm chưa đặt ngân sách tháng này. */
  unbudgeted: boolean;
}

export interface MonthEval {
  kind: BudgetKind;
  month: string;
  /** Tổng ngân sách các nhóm đã đặt. */
  totalBudget: number;
  /** Tổng thực tế CỦA CÁC NHÓM ĐÃ ĐẶT ngân sách — đối chiếu được với `totalBudget`. */
  totalActual: number;
  /** Thực tế của các nhóm chưa đặt ngân sách. */
  unbudgetedActual: number;
  remaining: number;
  pct: number | null;
  level: BudgetLevel;
  groups: GroupEval[];
  /** Nhóm vượt (chi) — rỗng với thu. Xếp theo mức vượt giảm dần. */
  overGroups: GroupEval[];
}

/** Đánh giá một tháng: ngân sách của tháng (`budgets` đã lọc đúng tháng + kind) so với thực tế. */
export function evaluateMonth(
  kind: BudgetKind,
  month: string,
  budgets: { categoryGroup: string; amount: number }[],
  actuals: Map<string, number>
): MonthEval {
  const budgetOf = new Map<string, number>();
  for (const b of budgets) budgetOf.set(b.categoryGroup, (budgetOf.get(b.categoryGroup) || 0) + b.amount);

  const names = new Set<string>([...budgetOf.keys(), ...actuals.keys()]);
  const groups: GroupEval[] = [];
  for (const g of names) {
    const budget = budgetOf.get(g) || 0;
    const actual = actuals.get(g) || 0;
    if (budget === 0 && !budgetOf.has(g) && actual === 0) continue;
    groups.push({
      group: g,
      budget,
      actual,
      remaining: budget - actual,
      pct: pctOf(actual, budget),
      level: levelOf(kind, budget, actual),
      unbudgeted: !budgetOf.has(g),
    });
  }
  groups.sort((a, b) => b.budget - a.budget || b.actual - a.actual || a.group.localeCompare(b.group));

  const budgeted = groups.filter((g) => !g.unbudgeted);
  const totalBudget = budgeted.reduce((s, g) => s + g.budget, 0);
  const totalActual = budgeted.reduce((s, g) => s + g.actual, 0);
  const unbudgetedActual = groups.filter((g) => g.unbudgeted).reduce((s, g) => s + g.actual, 0);
  const overGroups =
    kind === "expense"
      ? groups
          .filter((g) => g.level === "over")
          .sort((a, b) => b.actual - b.budget - (a.actual - a.budget))
      : [];

  return {
    kind,
    month,
    totalBudget,
    totalActual,
    unbudgetedActual,
    remaining: totalBudget - totalActual,
    pct: pctOf(totalActual, totalBudget),
    level: levelOf(kind, totalBudget, totalActual),
    groups,
    overGroups,
  };
}

// ---------------------------------------------------------------------------
// Đánh giá năm
// ---------------------------------------------------------------------------

export interface YearCell {
  month: string;
  budget: number;
  actual: number;
  pct: number | null;
  level: BudgetLevel;
  /** Tháng chưa tới — chưa có thực tế để đánh giá, không tính "vượt". */
  future: boolean;
}

export interface YearGroupRow {
  group: string;
  cells: YearCell[]; // 12 ô
  totalBudget: number;
  totalActual: number;
  pct: number | null;
  level: BudgetLevel;
  /** Số tháng (đã tới) nhóm này vượt ngân sách. 0 với thu. */
  monthsOver: number;
  /** Số tháng (đã tới) đạt mục tiêu. 0 với chi. */
  monthsHit: number;
}

export interface YearEval {
  kind: BudgetKind;
  year: string;
  months: YearCell[]; // tổng cả nhóm từng tháng
  groups: YearGroupRow[];
  totalBudget: number;
  totalActual: number;
  /** Chỉ cộng các tháng ĐÃ TỚI — so ngân sách cả năm với thực tế nửa năm thì tháng nào cũng "dưới". */
  totalBudgetToDate: number;
  pct: number | null;
  pctToDate: number | null;
  level: BudgetLevel;
  /** Số tháng (đã tới, có ngân sách) mà TỔNG chi vượt TỔNG ngân sách. */
  monthsOver: number;
  monthsHit: number;
  /** Số tháng đã tới và có ngân sách — mẫu số của `monthsOver`. */
  monthsEvaluated: number;
  /** Số tháng của cả năm có đặt ngân sách. */
  monthsWithBudget: number;
}

/**
 * Đánh giá cả năm.
 *
 * `budgets`: mọi dòng ngân sách `monthly` của năm (đúng `kind`). `actuals`: thực
 * tế từng tháng (xem `actualsByMonth`). `currentMonth`: tháng đang chạy — tháng
 * sau nó là `future`.
 */
export function evaluateYear(
  kind: BudgetKind,
  year: string,
  budgets: BudgetLike[],
  actuals: Map<string, Map<string, number>>,
  currentMonth: string
): YearEval {
  const months = monthsOfYear(year);
  const budgetOf = new Map<string, Map<string, number>>(); // month → group → amount
  for (const b of budgets) {
    if (!b.period.startsWith(year)) continue;
    const m = budgetOf.get(b.period) ?? new Map<string, number>();
    m.set(b.categoryGroup, (m.get(b.categoryGroup) || 0) + b.amount);
    budgetOf.set(b.period, m);
  }

  // Nhóm nào có ngân sách hoặc thực tế trong năm thì có một hàng.
  const names = new Set<string>();
  for (const m of budgetOf.values()) for (const g of m.keys()) names.add(g);
  for (const m of months) for (const g of actuals.get(m)?.keys() ?? []) names.add(g);

  const cell = (month: string, budget: number, actual: number): YearCell => {
    const future = month > currentMonth;
    return {
      month,
      budget,
      actual: future ? 0 : actual,
      pct: future ? null : pctOf(actual, budget),
      level: future ? "none" : levelOf(kind, budget, actual),
      future,
    };
  };

  const groups: YearGroupRow[] = [];
  for (const g of names) {
    const cells = months.map((m) => cell(m, budgetOf.get(m)?.get(g) || 0, actuals.get(m)?.get(g) || 0));
    const totalBudget = cells.reduce((s, c) => s + c.budget, 0);
    const totalActual = cells.reduce((s, c) => s + c.actual, 0);
    if (totalBudget === 0 && totalActual === 0) continue;
    const toDate = cells.filter((c) => !c.future);
    const budgetToDate = toDate.reduce((s, c) => s + c.budget, 0);
    groups.push({
      group: g,
      cells,
      totalBudget,
      totalActual,
      pct: pctOf(totalActual, budgetToDate),
      level: levelOf(kind, budgetToDate, totalActual),
      monthsOver: cells.filter((c) => c.level === "over").length,
      monthsHit: cells.filter((c) => c.level === "hit").length,
    });
  }
  groups.sort((a, b) => b.totalBudget - a.totalBudget || b.totalActual - a.totalActual || a.group.localeCompare(b.group));

  // Tổng từng tháng: chỉ cộng nhóm ĐÃ đặt ngân sách tháng đó, để đối chiếu cùng phạm vi
  // với `evaluateMonth.totalActual`.
  const monthCells: YearCell[] = months.map((m) => {
    const bm = budgetOf.get(m);
    const budget = bm ? [...bm.values()].reduce((s, v) => s + v, 0) : 0;
    const actual = bm ? [...bm.keys()].reduce((s, g) => s + (actuals.get(m)?.get(g) || 0), 0) : 0;
    return cell(m, budget, actual);
  });

  const totalBudget = monthCells.reduce((s, c) => s + c.budget, 0);
  const totalActual = monthCells.reduce((s, c) => s + c.actual, 0);
  const evaluated = monthCells.filter((c) => !c.future && c.budget > 0);
  const totalBudgetToDate = monthCells.filter((c) => !c.future).reduce((s, c) => s + c.budget, 0);

  return {
    kind,
    year,
    months: monthCells,
    groups,
    totalBudget,
    totalActual,
    totalBudgetToDate,
    pct: pctOf(totalActual, totalBudget),
    pctToDate: pctOf(totalActual, totalBudgetToDate),
    level: levelOf(kind, totalBudgetToDate, totalActual),
    monthsOver: evaluated.filter((c) => c.level === "over").length,
    monthsHit: evaluated.filter((c) => c.level === "hit").length,
    monthsEvaluated: evaluated.length,
    monthsWithBudget: monthCells.filter((c) => c.budget > 0).length,
  };
}

// ---------------------------------------------------------------------------
// Chép từ tháng trước
// ---------------------------------------------------------------------------

/**
 * Những dòng cần TẠO khi chép ngân sách từ tháng `from` sang tháng `to`.
 *
 * Mặc định chỉ chép nhóm tháng đích CHƯA có — không đè số người dùng đã đặt cho
 * tháng đó. `overwrite` mới ghi đè (và chỉ những nhóm có ở tháng nguồn).
 */
export function planCopy(
  source: { categoryGroup: string; amount: number }[],
  existingTarget: { categoryGroup: string }[],
  overwrite: boolean
): { categoryGroup: string; amount: number; notes: string | null; action: "create" | "update" }[] {
  const have = new Set(existingTarget.map((b) => b.categoryGroup));
  const out: { categoryGroup: string; amount: number; notes: string | null; action: "create" | "update" }[] = [];
  for (const s of source) {
    const exists = have.has(s.categoryGroup);
    if (exists && !overwrite) continue;
    out.push({
      categoryGroup: s.categoryGroup,
      amount: s.amount,
      // Ghi chú của tháng nguồn ("tạm tính", lý do đặt) là của tháng đó, không chép.
      notes: null,
      action: exists ? "update" : "create",
    });
  }
  return out;
}
