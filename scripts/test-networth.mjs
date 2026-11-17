// Kiểm tra src/lib/netWorth.ts bằng số liệu dựng tay (không đụng DB).
//   node --import ./scripts/register-ts.mjs scripts/test-networth.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  assetWorthAt, debtOutstandingAt, snapshotForMonth, buildSeries, earliestMonth, monthRange, monthCutoff,
} from "../src/lib/netWorth.ts";
import { currentWorth } from "../src/lib/assets.ts";

const d = (s) => new Date(`${s}T00:00:00Z`);

const asset = (over = {}) => ({
  id: "a1", acquisitionDate: d("2020-03-27"), acquisitionCost: 2_100_000_000,
  depreciationMethod: "none", usefulLifeMonths: 0, salvageValue: 0,
  currentValue: null, valuationDate: null, status: "owned", disposalAmount: null, disposalDate: null,
  ...over,
});
const sched = (period, due, opening, closing, status = "paid") => ({
  period, dueDate: d(due), openingBalance: opening, closingBalance: closing, status,
});
const loan = (over = {}) => ({
  id: "d1", name: "Vay nhà", startDate: d("2020-03-27"), principal: 1_000, remaining: 700,
  schedule: [
    sched(1, "2020-05-11", 1_000, 900),
    sched(2, "2020-06-10", 900, 800),
    sched(3, "2020-07-10", 800, 700, "projected"),
  ],
  ...over,
});
const empty = { accounts: [], transactions: [], assets: [], debts: [] };

test("tài sản: chưa mua = 0, không khấu hao giữ nguyên giá", () => {
  const a = asset();
  assert.equal(assetWorthAt(a, d("2020-02-29")), 0);
  assert.equal(assetWorthAt(a, d("2020-03-31")), 2_100_000_000);
  assert.equal(assetWorthAt(a, d("2026-11-17")), 2_100_000_000);
});

test("tài sản: khấu hao đường thẳng theo tháng, không xuống dưới giá trị thanh lý", () => {
  const v = asset({ depreciationMethod: "straight_line", usefulLifeMonths: 120, acquisitionCost: 1_200, salvageValue: 0, acquisitionDate: d("2024-01-15") });
  assert.equal(assetWorthAt(v, d("2024-01-31")), 1_200); // chưa đủ một tháng trọn
  assert.equal(assetWorthAt(v, d("2025-01-31")), 1_200 - 120); // 12 tháng
  assert.equal(assetWorthAt(v, d("2040-01-31")), 0); // hết đời
});

test("tài sản: định giá lại chỉ áp từ valuationDate trở đi", () => {
  const v = asset({ depreciationMethod: "straight_line", usefulLifeMonths: 120, acquisitionCost: 1_200, acquisitionDate: d("2024-01-15"), currentValue: 5_000, valuationDate: d("2026-06-01") });
  assert.equal(assetWorthAt(v, d("2026-05-31")), 1_200 - 10 * 28); // 28 tháng × 10, chưa dùng 5.000
  assert.notEqual(assetWorthAt(v, d("2026-05-31")), 5_000);
  assert.equal(assetWorthAt(v, d("2026-06-30")), 5_000);
});

test("tài sản: đã bán chỉ mất khỏi tháng bán trở đi; thiếu ngày bán thì mất ở mọi tháng", () => {
  const sold = asset({ status: "sold", disposalDate: d("2024-05-10") });
  assert.equal(assetWorthAt(sold, d("2024-04-30")), 2_100_000_000);
  assert.equal(assetWorthAt(sold, d("2024-05-31")), 0);
  const noDate = asset({ status: "sold" });
  assert.equal(assetWorthAt(noDate, d("2024-04-30")), 0);
});

test("tháng hiện tại khớp currentWorth của tab Tài sản", () => {
  const now = d("2026-11-17");
  for (const a of [asset(), asset({ depreciationMethod: "straight_line", usefulLifeMonths: 48, acquisitionCost: 30_000_000, acquisitionDate: d("2024-11-20") }),
                   asset({ currentValue: 2_500_000_000, valuationDate: d("2026-01-01") })]) {
    assert.equal(assetWorthAt(a, now), currentWorth(a, now));
  }
});

test("nợ: trước ngày vay = 0; chưa có kỳ trả = dư nợ đầu kỳ 1; kỳ projected không tính", () => {
  const l = loan();
  assert.equal(debtOutstandingAt(l, d("2020-03-01")).value, 0);
  assert.equal(debtOutstandingAt(l, d("2020-04-30")).value, 1_000);
  assert.equal(debtOutstandingAt(l, d("2020-05-31")).value, 900);
  assert.equal(debtOutstandingAt(l, d("2020-06-30")).value, 800);
  // Kỳ 3 chưa chốt (projected) → dư nợ vẫn là cuối kỳ 2 dù đã qua hạn
  assert.equal(debtOutstandingAt(l, d("2021-01-31")).value, 800);
});

test("nợ: không có lịch thì dùng Debt.remaining và báo là dự phòng", () => {
  const r = debtOutstandingAt(loan({ schedule: [] }), d("2021-01-31"));
  assert.deepEqual(r, { value: 700, fallback: true });
});

test("tiền: số dư tới cuối tháng, tài khoản mở sau mốc không tính, thẻ là nợ", () => {
  const bank = { id: "b1", name: "VCB", kind: "bank", bank: null, last4: null, openingBalance: 1_000, openingDate: d("2026-08-01"), creditLimit: null, statementDay: null, dueDay: null, status: "active", notes: null };
  const card = { id: "c1", name: "Thẻ", kind: "credit_card", bank: null, last4: null, openingBalance: 0, openingDate: d("2026-10-10"), creditLimit: 5_000, statementDay: null, dueDay: null, status: "active", notes: null };
  const closed = { ...bank, id: "x", name: "Cũ", openingBalance: 99_999, status: "closed" };
  const txs = [
    { date: d("2026-08-15"), type: "Income", totalAmount: 500, accountId: "b1", toAccountId: null },
    { date: d("2026-09-20"), type: "Expense", totalAmount: 200, accountId: "b1", toAccountId: null },
    { date: d("2026-10-20"), type: "Expense", totalAmount: 300, accountId: "c1", toAccountId: null }, // quẹt thẻ
    { date: d("2026-11-10"), type: "Transfer", totalAmount: 100, accountId: "b1", toAccountId: "c1" }, // trả thẻ
    { date: d("2026-11-25"), type: "Expense", totalAmount: 7_777, accountId: "b1", toAccountId: null }, // sau "bây giờ"
  ];
  const input = { ...empty, accounts: [bank, card, closed], transactions: txs };
  const now = d("2026-11-17");

  const jul = snapshotForMonth(input, "2026-07", now);
  assert.equal(jul.cash, 0);
  assert.ok(jul.warnings.includes("no-accounts"));

  const aug = snapshotForMonth(input, "2026-08", now);
  assert.equal(aug.cash, 1_500);
  assert.equal(aug.netWorth, 1_500);

  const sep = snapshotForMonth(input, "2026-09", now);
  assert.equal(sep.cash, 1_300);

  const oct = snapshotForMonth(input, "2026-10", now);
  assert.equal(oct.cash, 1_300);
  assert.equal(oct.detail.cardDebt, 300);
  assert.equal(oct.debts, 300);
  assert.equal(oct.netWorth, 1_000);

  // Tháng hiện tại: giao dịch ngày 25 chưa tới; trả thẻ 100 làm tiền −100 và nợ thẻ −100
  const nov = snapshotForMonth(input, "2026-11", now);
  assert.equal(nov.cash, 1_200);
  assert.equal(nov.detail.cardDebt, 200);
  assert.equal(nov.netWorth, 1_000);
});

test("tổng hợp: tài sản + tiền, nợ vay + nợ thẻ, ròng = tài sản − nợ", () => {
  const input = { ...empty, assets: [asset()], debts: [loan()] };
  const now = d("2026-11-17");
  const s = snapshotForMonth(input, "2020-06", now);
  assert.equal(s.assets, 2_100_000_000);
  assert.equal(s.debts, 800);
  assert.equal(s.netWorth, 2_100_000_000 - 800);
  assert.equal(s.assets - s.debts, s.netWorth);
});

test("chuỗi: earliestMonth, monthRange, buildSeries đủ tháng", () => {
  const input = { ...empty, assets: [asset()], debts: [loan()] };
  assert.equal(earliestMonth(input), "2020-03");
  assert.equal(earliestMonth(empty), null);
  assert.deepEqual(monthRange("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  const series = buildSeries(input, "2020-03", "2020-08", d("2026-11-17"));
  assert.equal(series.length, 6);
  assert.deepEqual(series.map((x) => x.debts), [1_000, 1_000, 900, 800, 800, 800]);
});

test("mốc tháng: tháng đã qua cắt ở cuối tháng, tháng hiện tại cắt ở bây giờ", () => {
  const now = d("2026-11-17");
  const past = monthCutoff("2026-10", now);
  assert.equal(past.cutoff.toISOString().slice(0, 10), "2026-11-01");
  assert.equal(past.asOf.toISOString().slice(0, 10), "2026-10-31");
  assert.equal(past.current, false);
  assert.equal(monthCutoff("2026-11", now).current, true);
});
