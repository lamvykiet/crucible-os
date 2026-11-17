// Tài sản ròng cuối mỗi tháng — phần TÍNH, không đụng DB (phần đọc/ghi DB ở
// `netWorthServer.ts`). Không import prisma/React để kiểm được bằng node.
//
//   tài sản ròng = tổng tài sản − tổng nợ
//   tổng tài sản = tiền ở tài khoản (không phải thẻ) + giá trị tài sản
//   tổng nợ      = dư nợ các khoản vay + dư nợ thẻ tín dụng
//
// NGUỒN TỪNG SỐ (dùng đúng hàm đang chạy ở các tab, không viết công thức thứ hai):
//
//   tiền / dư nợ thẻ  `accountBalances()` (lib/accounts) trên các giao dịch có
//                     gắn tài khoản và có ngày TRƯỚC mốc cuối tháng.
//   giá trị tài sản   `bookValue()` / định giá lại của `lib/assets` tại mốc cuối tháng.
//   dư nợ vay         `DebtSchedule.closingBalance` của kỳ ĐÃ CHỐT gần nhất có
//                     hạn trả ≤ mốc cuối tháng (cùng cách `api/finance/assets`
//                     tính dư nợ); chưa có kỳ nào thì lấy dư nợ đầu kỳ 1; khoản
//                     vay không có lịch thì lấy `Debt.remaining`.
//
// CÁC THÁNG QUÁ KHỨ LÀ ƯỚC TÍNH — dựng lại, không phải số đã ghi lúc đó:
//
//   1. Tiền chỉ có ở tài khoản ĐÃ KHAI BÁO và chỉ từ các giao dịch ĐÃ GẮN tài
//      khoản. Tiền mặt, tài khoản ngân hàng chưa khai báo không có trong số này;
//      giao dịch cũ chưa gắn tài khoản không làm đổi số dư. Tháng nào chưa có
//      tài khoản nào (hoặc trước ngày khai báo của nó) thì tiền = 0 — đó là "chưa
//      ghi", không phải "không có".
//   2. Tài sản dùng giá định giá hiện tại (`currentValue`) cho mọi tháng từ
//      `valuationDate` trở đi; trước đó dùng giá trị sổ sách. Nhà đã được định
//      giá lại sẽ không lên xuống theo thị trường trong quá khứ vì không có lịch
//      sử giá.
//   3. Tài sản đã bán/xoá sổ mà thiếu `disposalDate` bị coi là không còn ở MỌI
//      tháng; có ngày thì còn tới ngày đó.
//   4. Dư nợ vay lấy theo lịch trả nợ hiện hành — nếu lịch từng bị chỉnh lại, số
//      quá khứ là số của lịch mới, không phải số ngân hàng báo lúc đó.
//   5. Tài khoản đã đóng (`status = closed`) không được tính ở tháng nào.
//
// Tháng ĐANG CHẠY dùng mốc "bây giờ" và là số chụp từ dữ liệu hiện tại
// (`source = computed`); các tháng đã qua dựng lại là `source = backfill`.

import { accountBalances, type AccountRow, type TxRow } from "./accounts";
import { bookValue, type AssetLike } from "./assets";

export interface AssetInput extends AssetLike {
  id: string;
  valuationDate: Date | null;
  disposalDate: Date | null;
}

export interface DebtScheduleInput {
  period: number;
  dueDate: Date;
  openingBalance: number;
  closingBalance: number;
  status: string; // paid | projected
}

export interface DebtInput {
  id: string;
  name: string;
  startDate: Date;
  principal: number;
  remaining: number;
  schedule: DebtScheduleInput[];
}

export interface NetWorthInput {
  accounts: AccountRow[];
  /** Chỉ cần giao dịch có `accountId` hoặc `toAccountId`. */
  transactions: TxRow[];
  assets: AssetInput[];
  debts: DebtInput[];
}

export interface SnapshotParts {
  month: string;
  assets: number;
  debts: number;
  cash: number;
  netWorth: number;
  /** Tách nhỏ để nói rõ từng số đến từ đâu. */
  detail: {
    cash: number; // = cash
    assetsValue: number;
    loanDebt: number;
    cardDebt: number;
  };
  /** Điều đáng nói về số này (khoản vay thiếu lịch, chưa có tài khoản…). */
  warnings: string[];
}

export const isMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const DAY = 86_400_000;

export const monthOf = (d: Date) => d.toISOString().slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

/** Các tháng từ `from` tới `to`, gồm cả hai đầu. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

/**
 * Mốc tính của một tháng. Tháng đã qua: tới hết ngày cuối tháng (`cutoff` là đầu
 * tháng sau, KHÔNG bao gồm; `asOf` là ngày cuối tháng). Tháng đang chạy: tới `now`.
 */
export function monthCutoff(month: string, now: Date): { cutoff: Date; asOf: Date; current: boolean } {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1;
  const nextStart = new Date(Date.UTC(y, m + 1, 1));
  const current = monthOf(now) === month;
  if (current) return { cutoff: now, asOf: now, current };
  return { cutoff: nextStart, asOf: new Date(nextStart.getTime() - DAY), current };
}

/** Giá trị một tài sản tại `asOf` (xem giới hạn 2 và 3 ở đầu file). */
export function assetWorthAt(a: AssetInput, asOf: Date): number {
  if (a.acquisitionDate.getTime() > asOf.getTime()) return 0;
  const gone = a.status !== "owned" && (!a.disposalDate || a.disposalDate.getTime() <= asOf.getTime());
  if (gone) return 0;
  const revalued =
    a.currentValue !== null && a.currentValue !== undefined &&
    (!a.valuationDate || a.valuationDate.getTime() <= asOf.getTime());
  return revalued ? (a.currentValue as number) : bookValue(a, asOf);
}

/** Dư nợ một khoản vay tại `asOf`; `estimated` là chỉ số dựa vào `Debt.remaining` thay vì lịch. */
export function debtOutstandingAt(d: DebtInput, asOf: Date): { value: number; fallback: boolean } {
  if (d.startDate.getTime() > asOf.getTime()) return { value: 0, fallback: false };
  if (d.schedule.length === 0) return { value: d.remaining, fallback: true };

  const rows = [...d.schedule].sort((a, b) => a.period - b.period);
  let lastPaid: DebtScheduleInput | null = null;
  for (const r of rows) {
    if (r.status === "paid" && r.dueDate.getTime() <= asOf.getTime()) lastPaid = r;
  }
  return { value: lastPaid ? lastPaid.closingBalance : rows[0].openingBalance, fallback: false };
}

/** Tài sản ròng cuối `month` (hoặc tới `now` nếu là tháng đang chạy). */
export function snapshotForMonth(input: NetWorthInput, month: string, now: Date): SnapshotParts {
  const { cutoff, asOf } = monthCutoff(month, now);
  const cut = cutoff.getTime();
  const warnings: string[] = [];

  // Tài khoản đã khai báo trước mốc. Giao dịch lọc theo ngày: `accountBalances`
  // cộng mọi giao dịch nó được đưa, nên lọc ở đây.
  const accounts = input.accounts.filter((a) => !a.openingDate || a.openingDate.getTime() < cut);
  const txs = input.transactions.filter((t) => t.date.getTime() < cut);
  const { totals } = accountBalances(accounts, txs);
  const openAccounts = accounts.filter((a) => a.status !== "closed");
  if (openAccounts.length === 0) warnings.push("no-accounts");

  const assetsValue = input.assets.reduce((s, a) => s + assetWorthAt(a, asOf), 0);

  let loanDebt = 0;
  for (const d of input.debts) {
    const r = debtOutstandingAt(d, asOf);
    loanDebt += r.value;
    if (r.fallback) warnings.push(`debt-no-schedule:${d.name}`);
  }

  const cash = totals.cash;
  const cardDebt = totals.cardDebt;
  const assets = cash + assetsValue;
  const debts = loanDebt + cardDebt;

  return {
    month,
    assets,
    debts,
    cash,
    netWorth: assets - debts,
    detail: { cash, assetsValue, loanDebt, cardDebt },
    warnings,
  };
}

/** Tháng sớm nhất có dữ liệu để dựng: ngày mua tài sản, ngày vay, ngày mở tài khoản, giao dịch gắn tài khoản. */
export function earliestMonth(input: NetWorthInput): string | null {
  const dates: Date[] = [
    ...input.assets.map((a) => a.acquisitionDate),
    ...input.debts.map((d) => d.startDate),
    ...input.accounts.flatMap((a) => (a.openingDate ? [a.openingDate] : [])),
    ...input.transactions.map((t) => t.date),
  ];
  if (dates.length === 0) return null;
  const min = dates.reduce((a, b) => (b.getTime() < a.getTime() ? b : a));
  return monthOf(min);
}

/** Dựng chuỗi các tháng từ `from` tới `to`. */
export function buildSeries(input: NetWorthInput, from: string, to: string, now: Date): SnapshotParts[] {
  return monthRange(from, to).map((m) => snapshotForMonth(input, m, now));
}
