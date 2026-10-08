// Chi phí dự án theo kiểu kế toán giá thành: phân bổ → sổ cái → WIP / giá vốn.
//
// File này là hàm thuần, dùng được cả ở máy chủ lẫn trình duyệt. Phần đụng DB
// nằm ở `projectLedger.ts`.

/** Năm nhóm chi phí chuẩn + doanh thu. Danh sách cố định — thêm nhóm là đổi
 *  code ở đây, không phải bảng, vì báo cáo giá vốn bóc tách đúng năm nhóm này. */
export const COST_CATEGORIES = [
  {
    code: "RAW_MATERIAL",
    en: "Raw materials",
    vi: "Nguyên vật liệu",
    hintVi: "nhựa, linh kiện, vật tư dùng thẳng vào sản phẩm",
    hintEn: "filament, parts, supplies that go into the product",
    classification: "DIRECT_MATERIAL",
  },
  {
    code: "MACHINERY",
    en: "Machinery",
    vi: "Máy móc",
    hintVi: "mua máy, thuê máy, khấu hao, sửa máy",
    hintEn: "buying, renting, depreciating or repairing machines",
    classification: "CAPEX",
  },
  {
    code: "TESTING",
    en: "Testing",
    vi: "Kiểm thử",
    hintVi: "in thử, mua tool, thuê lab, chạy thử",
    hintEn: "test prints, tools, lab hire, trial runs",
    classification: "OVERHEAD",
  },
  {
    code: "LABOR",
    en: "Labour",
    vi: "Nhân công",
    hintVi: "trả công thợ, cộng tác viên",
    hintEn: "paying workers or freelancers",
    classification: "DIRECT_LABOR",
  },
  {
    code: "OVERHEAD",
    en: "Other overheads",
    vi: "Chi phí khác",
    hintVi: "điện, nước, vận chuyển, mặt bằng…",
    hintEn: "power, water, shipping, rent…",
    classification: "OVERHEAD",
  },
] as const;

export type CostCategoryCode = (typeof COST_CATEGORIES)[number]["code"];
export const REVENUE = "REVENUE";
export const COST_CODES = COST_CATEGORIES.map((c) => c.code) as CostCategoryCode[];

export const isCostCategory = (code: string): code is CostCategoryCode =>
  (COST_CODES as string[]).includes(code);

export const costCategoryOf = (code: string) => COST_CATEGORIES.find((c) => c.code === code);

/** Ba nhóm phân loại giá vốn, gom từ năm nhóm chi phí. */
export const CLASSIFICATIONS = {
  DIRECT: { en: "Direct costs", vi: "Chi phí trực tiếp", codes: ["RAW_MATERIAL", "LABOR"] },
  INDIRECT: { en: "Indirect costs", vi: "Chi phí gián tiếp", codes: ["TESTING", "OVERHEAD"] },
  CAPEX: { en: "Machinery (capex)", vi: "Đầu tư máy móc", codes: ["MACHINERY"] },
} as const;

// --- Phân bổ ---------------------------------------------------------------

export interface Split {
  projectId: string;
  costCategory: string;
  percentage: number;
  notes?: string | null;
}

/** Loại giao dịch nào đi vào dự án, và đi vào phía nào. */
export function projectSide(type: string): "cost" | "revenue" | null {
  if (type === "Expense" || type === "Refund") return "cost";
  if (type === "Income") return "revenue";
  return null;
}

/**
 * Làm sạch danh sách phân bổ gửi từ form.
 *
 * Trả về lỗi bằng tiếng Việt thay vì lặng lẽ sửa: tổng 130% là người dùng
 * nhập nhầm, tự cắt về 100% thì số liệu dự án sai mà không ai biết.
 */
export function cleanSplits(
  raw: unknown,
  type: string
): { splits: Split[]; error?: string } {
  const side = projectSide(type);
  if (!Array.isArray(raw) || !side) return { splits: [] };

  const splits: Split[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const projectId = typeof row.projectId === "string" ? row.projectId : "";
    if (!projectId) continue;
    const pct = Math.round(Number(row.percentage ?? 100) * 100) / 100;
    if (!(pct > 0) || pct > 100) return { splits: [], error: "Tỷ lệ phân bổ phải lớn hơn 0% và không quá 100%" };
    // Doanh thu không có nhóm chi phí; khoản chi thì phải thuộc một trong năm nhóm.
    const costCategory =
      side === "revenue"
        ? REVENUE
        : isCostCategory(String(row.costCategory))
          ? String(row.costCategory)
          : "RAW_MATERIAL";
    splits.push({
      projectId,
      costCategory,
      percentage: pct,
      notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim().slice(0, 300) : null,
    });
  }

  const seen = new Set<string>();
  for (const s of splits) {
    const key = `${s.projectId}|${s.costCategory}`;
    if (seen.has(key)) return { splits: [], error: "Một dự án bị chọn hai lần cho cùng một nhóm chi phí" };
    seen.add(key);
  }

  const total = splits.reduce((sum, s) => sum + s.percentage, 0);
  if (total > 100.001) {
    return { splits: [], error: `Tổng phân bổ là ${Math.round(total * 100) / 100}% — không được quá 100%` };
  }
  return { splits };
}

/**
 * Chia số tiền theo %. Khi tổng đủ 100%, phần lẻ do làm tròn dồn vào phần cuối
 * để tổng các phần khớp đúng tổng giao dịch — lệch 1 đồng cũng là sổ không khớp.
 */
export function splitAmounts(total: number, splits: Pick<Split, "percentage">[]) {
  const amounts = splits.map((s) => Math.round((Math.abs(total) * s.percentage) / 100));
  const pctSum = splits.reduce((sum, s) => sum + s.percentage, 0);
  if (amounts.length > 0 && Math.abs(pctSum - 100) < 0.001) {
    const others = amounts.slice(0, -1).reduce((a, b) => a + b, 0);
    amounts[amounts.length - 1] = Math.abs(total) - others;
  }
  return amounts;
}

// --- Sổ cái ----------------------------------------------------------------

export type Bucket = "WIP" | "COGS" | "REVENUE";

export interface LedgerRow {
  id?: string;
  projectId: string;
  transactionId: string | null;
  costCategory: string;
  bucket: string;
  entryType: string;
  amount: number;
  kind: string;
  postingDate: Date | string;
  note?: string | null;
  createdAt?: Date | string;
}

/**
 * Giá trị có dấu của một dòng sổ theo "chiều tự nhiên" của tài khoản: chi phí
 * (WIP, COGS) tăng bên Nợ, doanh thu tăng bên Có.
 */
export function signedAmount(row: Pick<LedgerRow, "bucket" | "entryType" | "amount">) {
  const natural = row.bucket === "REVENUE" ? "CREDIT" : "DEBIT";
  return row.entryType === natural ? row.amount : -row.amount;
}

/** Phân bổ hiện tại của một giao dịch → các số dư mà sổ cái PHẢI có cho nó. */
export function desiredBalances(
  type: string,
  allocations: { projectId: string; costCategory: string; amount: number }[]
) {
  const side = projectSide(type);
  const out = new Map<string, number>();
  if (!side) return out;
  for (const a of allocations) {
    const bucket: Bucket = side === "revenue" ? "REVENUE" : "WIP";
    // Hoàn tiền là chi phí âm: mua hộ dự án rồi được trả lại.
    const value = type === "Refund" ? -a.amount : a.amount;
    const key = `${a.projectId}|${a.costCategory}|${bucket}`;
    out.set(key, (out.get(key) ?? 0) + value);
  }
  return out;
}

/**
 * Số dư từng (nhóm chi phí × WIP/COGS) của một dự án, cộng doanh thu.
 *
 * Tổng chi phí = WIP + COGS: kết chuyển chỉ dời tiền từ WIP sang COGS, không
 * làm đổi tổng.
 */
export function summarizeLedger(rows: LedgerRow[]) {
  const wip: Record<string, number> = {};
  const cogs: Record<string, number> = {};
  let revenue = 0;
  for (const code of COST_CODES) {
    wip[code] = 0;
    cogs[code] = 0;
  }
  for (const r of rows) {
    const v = signedAmount(r);
    if (r.bucket === "REVENUE") revenue += v;
    else if (r.bucket === "COGS") cogs[r.costCategory] = (cogs[r.costCategory] ?? 0) + v;
    else wip[r.costCategory] = (wip[r.costCategory] ?? 0) + v;
  }
  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
  const totalWip = sum(wip);
  const totalCogs = sum(cogs);
  return {
    wip,
    cogs,
    revenue,
    totalWip,
    totalCogs,
    totalCost: totalWip + totalCogs,
    /** Lợi nhuận gộp: doanh thu trừ phần chi phí ĐÃ kết chuyển thành giá vốn. */
    grossProfit: revenue - totalCogs,
  };
}

/**
 * Chia một khoản kết chuyển WIP → COGS cho từng nhóm chi phí theo tỷ trọng số
 * dư WIP hiện có. Nhóm nào WIP ≤ 0 thì không kết chuyển gì từ nhóm đó.
 */
export function planCogsTransfer(wip: Record<string, number>, amount: number) {
  const positive = Object.entries(wip).filter(([, v]) => v > 0);
  const base = positive.reduce((s, [, v]) => s + v, 0);
  if (base <= 0 || amount <= 0) return [];
  const take = Math.min(amount, base);
  const parts = positive.map(([code, v]) => ({ code, amount: Math.floor((take * v) / base) }));
  // Phần lẻ do làm tròn xuống dồn vào nhóm lớn nhất.
  const rest = take - parts.reduce((s, p) => s + p.amount, 0);
  if (rest > 0) {
    const biggest = parts.reduce((a, b) => (wip[b.code] > wip[a.code] ? b : a));
    biggest.amount += rest;
  }
  return parts.filter((p) => p.amount > 0);
}

/** Ngân sách so với thực tế, đúng như `status` trong spec: UNDER/OVER/ON_BUDGET. */
export function budgetStatus(budget: number | null | undefined, totalCost: number) {
  if (!budget) return { budget: null, variance: null, status: "NO_BUDGET" as const };
  const variance = budget - totalCost;
  return {
    budget,
    variance,
    status: variance > 0 ? ("UNDER_BUDGET" as const) : variance < 0 ? ("OVER_BUDGET" as const) : ("ON_BUDGET" as const),
  };
}
