import { prisma } from "@/lib/prisma";
import type { AccountRow, TxRow } from "@/lib/accounts";
import {
  buildSeries,
  earliestMonth,
  isMonth,
  monthOf,
  shiftMonth,
  snapshotForMonth,
  type NetWorthInput,
  type SnapshotParts,
} from "@/lib/netWorth";

// Đọc/ghi `NetWorthSnapshot`. Phần tính nằm ở `netWorth.ts`.

export interface SnapshotRow {
  month: string;
  assets: number;
  debts: number;
  cash: number;
  netWorth: number;
  source: string;
  updatedAt: string;
}

/** Cột BigInt → number. Tổng tiền VND còn xa mới chạm 2^53. */
const toRow = (r: {
  month: string; assets: bigint; debts: bigint; cash: bigint; netWorth: bigint; source: string; updatedAt: Date;
}): SnapshotRow => ({
  month: r.month,
  assets: Number(r.assets),
  debts: Number(r.debts),
  cash: Number(r.cash),
  netWorth: Number(r.netWorth),
  source: r.source,
  updatedAt: r.updatedAt.toISOString(),
});

/** Đọc mọi thứ cần để tính tài sản ròng của một người dùng. */
export async function loadNetWorthInput(userId: string): Promise<NetWorthInput> {
  const [accounts, transactions, assets, debts] = await Promise.all([
    prisma.account.findMany({ where: { userId } }),
    // Chỉ giao dịch có gắn tài khoản — giống `api/finance/accounts`.
    prisma.transaction.findMany({
      where: { userId, OR: [{ accountId: { not: null } }, { toAccountId: { not: null } }] },
      select: { date: true, type: true, totalAmount: true, accountId: true, toAccountId: true },
      orderBy: { date: "asc" },
    }),
    prisma.asset.findMany({ where: { userId } }),
    prisma.debt.findMany({
      where: { userId },
      include: {
        schedule: {
          orderBy: { period: "asc" },
          select: { period: true, dueDate: true, openingBalance: true, closingBalance: true, status: true },
        },
      },
    }),
  ]);
  return {
    accounts: accounts as AccountRow[],
    transactions: transactions as TxRow[],
    assets,
    debts,
  };
}

const writeData = (p: SnapshotParts, source: "computed" | "backfill") => ({
  assets: BigInt(Math.round(p.assets)),
  debts: BigInt(Math.round(p.debts)),
  cash: BigInt(Math.round(p.cash)),
  netWorth: BigInt(Math.round(p.netWorth)),
  source,
});

/**
 * Chụp tháng đang chạy rồi ghi đè dòng của nó (`computed`). Gọi mỗi lần mở
 * dashboard — một upsert, rẻ. Chỉ đụng đúng tháng hiện tại, không bao giờ đè
 * tháng đã qua.
 */
export async function refreshCurrentMonth(userId: string, now = new Date()) {
  const input = await loadNetWorthInput(userId);
  // Chưa có gì để chụp (người dùng mới) thì đừng ghi một dòng toàn số 0.
  if (earliestMonth(input) === null) return null;
  const month = monthOf(now);
  const parts = snapshotForMonth(input, month, now);
  const data = writeData(parts, "computed");
  await prisma.netWorthSnapshot.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, ...data },
    update: data,
  });
  return parts;
}

/** Chuỗi `months` tháng gần nhất đã lưu, cũ → mới. */
export async function readSeries(userId: string, months: number, now = new Date()): Promise<SnapshotRow[]> {
  const from = shiftMonth(monthOf(now), -(months - 1));
  const rows = await prisma.netWorthSnapshot.findMany({
    where: { userId, month: { gte: from } },
    orderBy: { month: "asc" },
  });
  return rows.map(toRow);
}

export interface RebuildOptions {
  /** Mặc định: tháng sớm nhất có dữ liệu. */
  from?: string;
  /** Mặc định: tháng TRƯỚC tháng hiện tại (tháng hiện tại do `refreshCurrentMonth` lo). */
  to?: string;
  dryRun?: boolean;
  /** Cho phép đè cả bản chụp `computed` của tháng đã qua. Mặc định giữ nguyên. */
  force?: boolean;
}

export interface RebuildItem extends SnapshotRow {
  /** create: chưa có · update: đè bản backfill cũ · skip: giữ bản `computed` có sẵn. */
  action: "create" | "update" | "skip";
  warnings: string[];
  detail: SnapshotParts["detail"];
}

export interface RebuildResult {
  dryRun: boolean;
  from: string | null;
  to: string | null;
  created: number;
  updated: number;
  skipped: number;
  items: RebuildItem[];
}

/**
 * Dựng lại các tháng quá khứ. `dryRun` chỉ tính và trả kết quả, không ghi gì.
 * Kết quả là ƯỚC TÍNH (`source = backfill`) — xem giới hạn ở đầu `netWorth.ts`.
 */
export async function rebuildSeries(userId: string, opts: RebuildOptions = {}, now = new Date()): Promise<RebuildResult> {
  const input = await loadNetWorthInput(userId);
  const first = earliestMonth(input);
  const last = shiftMonth(monthOf(now), -1);
  const from = opts.from && isMonth(opts.from) ? opts.from : first;
  const to = opts.to && isMonth(opts.to) ? (opts.to > last ? last : opts.to) : last;
  const empty: RebuildResult = { dryRun: !!opts.dryRun, from, to, created: 0, updated: 0, skipped: 0, items: [] };
  if (!from || from > to) return empty;

  const existing = await prisma.netWorthSnapshot.findMany({
    where: { userId, month: { gte: from, lte: to } },
    select: { month: true, source: true },
  });
  const sourceOf = new Map(existing.map((e) => [e.month, e.source]));

  const parts = buildSeries(input, from, to, now);
  const items: RebuildItem[] = parts.map((p) => {
    const had = sourceOf.get(p.month);
    const action: RebuildItem["action"] = !had ? "create" : had === "computed" && !opts.force ? "skip" : "update";
    return {
      month: p.month,
      assets: p.assets,
      debts: p.debts,
      cash: p.cash,
      netWorth: p.netWorth,
      source: "backfill",
      updatedAt: now.toISOString(),
      action,
      warnings: p.warnings,
      detail: p.detail,
    };
  });

  const result: RebuildResult = {
    dryRun: !!opts.dryRun,
    from,
    to,
    created: items.filter((i) => i.action === "create").length,
    updated: items.filter((i) => i.action === "update").length,
    skipped: items.filter((i) => i.action === "skip").length,
    items,
  };

  if (!opts.dryRun) {
    const writes = parts
      .filter((p) => items.find((i) => i.month === p.month)!.action !== "skip")
      .map((p) => {
        const data = writeData(p, "backfill");
        return prisma.netWorthSnapshot.upsert({
          where: { userId_month: { userId, month: p.month } },
          create: { userId, month: p.month, ...data },
          update: data,
        });
      });
    // Mảng thao tác (không phải callback) — chạy một lượt, không dính giới hạn
    // thời gian của transaction tương tác.
    if (writes.length > 0) await prisma.$transaction(writes);
  }
  return result;
}
