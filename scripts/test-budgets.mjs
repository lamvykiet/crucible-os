// Kiểm tra src/lib/budgets.ts bằng số liệu dựng tay (không đụng DB).
//   node --import ./scripts/register-ts.mjs scripts/test-budgets.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  actualsByGroup, actualsByMonth, evaluateMonth, evaluateYear, levelOf, planCopy,
  shiftMonth, isMonthKey, budgetKindOfCategory,
} from "../src/lib/budgets.ts";

const d = (s) => new Date(`${s}T00:00:00Z`);
const tx = (date, type, amount, group, source = "manual") => ({ date: d(date), type, totalAmount: amount, categoryGroup: group, source });

test("thực chi = Expense − Refund + trả gốc nợ của nhóm; Transfer không tính", () => {
  const txs = [
    tx("2026-11-02", "Expense", 100, "Food"),
    tx("2026-11-03", "Refund", 30, "Food"),
    tx("2026-11-04", "Income", 999, "Main Income"),
    tx("2026-11-05", "Transfer", 500, "Food"), // không phải chi
    tx("2026-11-06", "Transfer", 700, "Debt", "debt"), // trả gốc
    tx("2026-11-06", "Expense", 50, "Debt", "debt"), // lãi
  ];
  const exp = actualsByGroup(txs, "expense");
  assert.equal(exp.get("Food"), 70);
  assert.equal(exp.get("Debt"), 750);
  assert.equal(exp.has("Main Income"), false);
});

test("thực thu chỉ gồm Income, Refund không cộng vào thu", () => {
  const txs = [
    tx("2026-11-02", "Income", 1000, "Main Income"),
    tx("2026-11-03", "Refund", 300, "Main Income"),
    tx("2026-11-04", "Expense", 10, "Food"),
  ];
  const inc = actualsByGroup(txs, "income");
  assert.equal(inc.get("Main Income"), 1000);
  assert.equal(inc.size, 1);
});

test("levelOf: chi ok/near/over, thu ok/hit, chưa đặt = none", () => {
  assert.equal(levelOf("expense", 100, 50), "ok");
  assert.equal(levelOf("expense", 100, 85), "near");
  assert.equal(levelOf("expense", 100, 100), "near");
  assert.equal(levelOf("expense", 100, 101), "over");
  assert.equal(levelOf("expense", 0, 50), "none");
  assert.equal(levelOf("income", 100, 99), "ok");
  assert.equal(levelOf("income", 100, 100), "hit");
});

test("evaluateMonth: tổng, nhóm vượt, chi ngoài ngân sách tách riêng", () => {
  const ev = evaluateMonth(
    "expense", "2026-11",
    [{ categoryGroup: "Food", amount: 100 }, { categoryGroup: "Fun", amount: 200 }],
    new Map([["Food", 150], ["Fun", 20], ["Other", 40]])
  );
  assert.equal(ev.totalBudget, 300);
  assert.equal(ev.totalActual, 170); // Other chưa đặt ngân sách → không cộng vào đây
  assert.equal(ev.unbudgetedActual, 40);
  assert.equal(ev.remaining, 130);
  assert.equal(ev.pct, 57);
  assert.deepEqual(ev.overGroups.map((g) => g.group), ["Food"]);
  const other = ev.groups.find((g) => g.group === "Other");
  assert.equal(other.unbudgeted, true);
  assert.equal(other.pct, null);
});

test("evaluateYear: số tháng vượt, tháng tương lai không bị tính", () => {
  const budgets = [];
  for (const m of ["2026-01", "2026-02", "2026-03", "2026-04", "2026-12"]) {
    budgets.push({ period: m, categoryGroup: "Food", amount: 100 });
  }
  budgets.push({ period: "2026-01", categoryGroup: "Fun", amount: 50 });
  const txs = [
    tx("2026-01-10", "Expense", 120, "Food"), // vượt
    tx("2026-01-11", "Expense", 10, "Fun"),
    tx("2026-02-10", "Expense", 100, "Food"), // đúng bằng — không vượt
    tx("2026-03-10", "Expense", 130, "Food"), // vượt
    tx("2026-04-10", "Expense", 10, "Food"),
    tx("2026-12-10", "Expense", 9999, "Food"), // tương lai — đề phòng dữ liệu lạ
  ];
  const ev = evaluateYear("expense", "2026", budgets, actualsByMonth(txs, "expense"), "2026-04");
  assert.equal(ev.months.length, 12);
  assert.equal(ev.monthsWithBudget, 5);
  assert.equal(ev.monthsEvaluated, 4);
  // Tháng 1: tổng chi 130 < tổng ngân sách 150 (Food vượt nhưng Fun còn dư) → không vượt.
  // Tháng 3: 130 > 100 → vượt. Tháng 12 chưa tới nên không tính dù có số lạ.
  assert.equal(ev.monthsOver, 1);
  assert.equal(ev.months[11].actual, 0);
});

test("evaluateYear: tính vượt trên TỔNG của tháng, không phải từng nhóm", () => {
  const budgets = [
    { period: "2026-01", categoryGroup: "Food", amount: 100 },
    { period: "2026-01", categoryGroup: "Fun", amount: 50 },
    { period: "2026-02", categoryGroup: "Food", amount: 100 },
  ];
  const txs = [
    tx("2026-01-10", "Expense", 120, "Food"), // nhóm vượt
    tx("2026-01-11", "Expense", 10, "Fun"), // tổng 130 < 150 → tháng không vượt
    tx("2026-02-10", "Expense", 150, "Food"), // tổng vượt
  ];
  const ev = evaluateYear("expense", "2026", budgets, actualsByMonth(txs, "expense"), "2026-06");
  assert.equal(ev.monthsOver, 1);
  const food = ev.groups.find((g) => g.group === "Food");
  assert.equal(food.monthsOver, 2); // nhóm Food vượt cả hai tháng
  assert.equal(food.totalBudget, 200);
  assert.equal(food.totalActual, 270);
  assert.equal(ev.totalBudgetToDate, 250);
  assert.equal(ev.pctToDate, Math.round((280 / 250) * 100));
  // Tháng tương lai không có thực tế và không có mức
  const dec = ev.months[11];
  assert.equal(dec.future, true);
  assert.equal(dec.level, "none");
});

test("evaluateYear thu: đếm tháng đạt mục tiêu", () => {
  const budgets = [
    { period: "2026-01", categoryGroup: "Main Income", amount: 100 },
    { period: "2026-02", categoryGroup: "Main Income", amount: 100 },
  ];
  const txs = [tx("2026-01-05", "Income", 100, "Main Income"), tx("2026-02-05", "Income", 60, "Main Income")];
  const ev = evaluateYear("income", "2026", budgets, actualsByMonth(txs, "income"), "2026-03");
  assert.equal(ev.monthsHit, 1);
  assert.equal(ev.monthsOver, 0);
  assert.equal(ev.groups[0].monthsHit, 1);
});

test("lịch sử: sửa tháng 12 không đổi đánh giá tháng 11", () => {
  const nov = [{ categoryGroup: "Food", amount: 100 }];
  const before = evaluateMonth("expense", "2026-11", nov, new Map([["Food", 90]]));
  // Người dùng đặt lại tháng 12 → dòng tháng 12 đổi, bộ dòng tháng 11 vẫn như cũ
  const all = [
    { period: "2026-11", categoryGroup: "Food", amount: 100 },
    { period: "2026-12", categoryGroup: "Food", amount: 500 },
  ];
  const after = evaluateMonth("expense", "2026-11", all.filter((b) => b.period === "2026-11"), new Map([["Food", 90]]));
  assert.deepEqual(before, after);
});

test("planCopy: mặc định không đè nhóm tháng đích đã có", () => {
  const src = [{ categoryGroup: "Food", amount: 100 }, { categoryGroup: "Fun", amount: 50 }];
  const tgt = [{ categoryGroup: "Food" }];
  assert.deepEqual(planCopy(src, tgt, false).map((p) => [p.categoryGroup, p.action]), [["Fun", "create"]]);
  assert.deepEqual(planCopy(src, tgt, true).map((p) => [p.categoryGroup, p.action]), [["Food", "update"], ["Fun", "create"]]);
});

test("tháng: shiftMonth, isMonthKey, kind danh mục", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(isMonthKey("2026-13"), false);
  assert.equal(isMonthKey("2026-11"), true);
  assert.equal(budgetKindOfCategory("expense_group"), "expense");
  assert.equal(budgetKindOfCategory("income_group"), "income");
  assert.equal(budgetKindOfCategory("transaction_type"), null);
});
