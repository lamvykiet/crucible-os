export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { DEBT_CATEGORY_GROUP } from "@/lib/debtTransactions";
import {
  buildPeriods,
  parseIsoDate,
  pctChange,
  type PeriodKind,
  type Window,
} from "@/lib/periods";

// So sánh tuần này / tháng này / năm nay với kỳ liền trước và cùng kỳ năm ngoái.
//
// Một endpoint dùng chung cho cả năm tab Finance thay vì nhét logic so sánh vào
// từng API riêng: cách tính kỳ và cách cắt cho công bằng chỉ nên có MỘT bản.
//
// Ba cửa sổ đều bị cắt về cùng số ngày đã trôi qua — xem chú thích dài ở
// `src/lib/periods.ts` để biết vì sao. Không có bước đó thì đầu tháng nào cũng
// báo "giảm 90%".

interface Bucket {
  label: string;
  from: string;
  to: string;
  /** Kỳ này đã trọn vẹn chưa (mốc cắt trùng cuối kỳ). */
  complete: boolean;
  income: number;
  expense: number;
  /** Trả gốc — không phải chi tiêu nhưng vẫn là tiền ra. */
  debtPrincipal: number;
  cashOut: number;
  /** Nghĩa vụ trả nợ: gốc + lãi. */
  debtService: number;
  net: number;
  count: number;
  byCategory: { group: string; amount: number }[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function classify(type: string): "income" | "expense" | "refund" | "ignored" {
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

type Row = {
  type: string;
  totalAmount: number;
  categoryGroup: string;
  source: string;
};

function summarise(w: Window, rows: Row[]): Bucket {
  let income = 0;
  let gross = 0;
  let refunds = 0;
  let debtPrincipal = 0;
  const byCategory = new Map<string, number>();
  let debtInterest = 0;

  for (const t of rows) {
    const group = t.categoryGroup || "Khác";
    switch (classify(t.type)) {
      case "income":
        income += t.totalAmount;
        break;
      case "expense":
        gross += t.totalAmount;
        byCategory.set(group, (byCategory.get(group) || 0) + t.totalAmount);
        if (group === DEBT_CATEGORY_GROUP) debtInterest += t.totalAmount;
        break;
      case "refund":
        refunds += t.totalAmount;
        byCategory.set(group, (byCategory.get(group) || 0) - t.totalAmount);
        break;
      case "ignored":
        // Trả gốc do lịch trả nợ sinh ra: không phải chi tiêu, vẫn là tiền ra.
        if (t.source === "debt") debtPrincipal += t.totalAmount;
        break;
    }
  }

  const expense = gross - refunds;
  const cashOut = expense + debtPrincipal;
  return {
    label: w.label,
    from: iso(w.from),
    to: iso(new Date(w.to.getTime() - 86_400_000)),
    complete: w.to.getTime() >= w.fullTo.getTime(),
    income,
    expense,
    debtPrincipal,
    cashOut,
    debtService: debtInterest + debtPrincipal,
    net: income - cashOut,
    count: rows.length,
    byCategory: [...byCategory.entries()]
      .map(([group, amount]) => ({ group, amount }))
      .filter((c) => c.amount !== 0)
      .sort((a, b) => b.amount - a.amount),
  };
}

const METRICS = [
  "income",
  "expense",
  "debtPrincipal",
  "cashOut",
  "debtService",
  "net",
  "count",
] as const;

function deltas(cur: Bucket, base: Bucket) {
  const out: Record<string, { abs: number; pct: number | null }> = {};
  for (const m of METRICS) {
    out[m] = { abs: cur[m] - base[m], pct: pctChange(cur[m], base[m]) };
  }
  return out;
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const kindParam = searchParams.get("period");
    const kind: PeriodKind =
      kindParam === "week" || kindParam === "year" ? kindParam : "month";

    const anchor =
      parseIsoDate(searchParams.get("date") ?? "") ??
      parseIsoDate(new Date().toISOString().slice(0, 10))!;

    const periods = buildPeriods(kind, anchor);

    // Một lượt đọc phủ cả ba cửa sổ, rồi chia trong bộ nhớ. Ba truy vấn riêng
    // cho ba khoảng rời nhau thì tốn ba vòng đi-về tới Supabase mà không nhanh
    // hơn: dữ liệu ở quy mô vài trăm dòng.
    const earliest = periods.lastYear.from;
    const latest = periods.current.to;
    const all = await prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: earliest, lt: latest } },
      select: { date: true, type: true, totalAmount: true, categoryGroup: true, source: true },
    });

    const slice = (w: Window) =>
      all.filter((t) => t.date >= w.from && t.date < w.to);

    const current = summarise(periods.current, slice(periods.current));
    const previous = summarise(periods.previous, slice(periods.previous));
    const lastYear = summarise(periods.lastYear, slice(periods.lastYear));

    return NextResponse.json({
      success: true,
      data: {
        period: kind,
        anchor: iso(anchor),
        elapsedDays: periods.elapsedDays,
        isComplete: periods.isComplete,
        // Với kiểu `year`, cột thứ ba là TRỌN năm ngoái chứ không phải cùng kỳ
        // — giao diện phải đổi nhãn theo cờ này.
        lastYearIsFullPeriod: periods.lastYearIsFullPeriod,
        current,
        previous,
        lastYear,
        deltas: {
          previous: deltas(current, previous),
          lastYear: deltas(current, lastYear),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
