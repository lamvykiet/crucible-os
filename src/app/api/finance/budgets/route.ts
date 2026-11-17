export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  actualsByGroup,
  actualsByMonth,
  categoryKindOfBudget,
  evaluateMonth,
  evaluateYear,
  isBudgetKind,
  isMonthKey,
  isYearKey,
  levelOf,
  monthKeyOf,
  planCopy,
  shiftMonth,
  type BudgetKind,
} from "@/lib/budgets";

// Ngân sách theo tháng — chi (`kind=expense`) và mục tiêu thu (`kind=income`).
//
// Mỗi dòng là MỘT nhóm trong MỘT tháng. Đặt lại ngân sách tháng này chỉ sửa
// dòng của tháng này; các tháng trước giữ nguyên số đã đặt để đánh giá lại.
// Công thức thực tế/ngân sách nằm ở `src/lib/budgets.ts` (dashboard dùng chung).

const MAX_AMOUNT = 2_000_000_000; // cột Int của Postgres tối đa 2.147.483.647

const fail = (error: string, status = 400) =>
  NextResponse.json({ success: false, error }, { status });

const parseKind = (v: string | null): BudgetKind | null => {
  if (v === null || v === "") return "expense";
  return isBudgetKind(v) ? v : null;
};

/** Giao dịch trong [from, to) với đúng các cột phép tính cần. */
const txBetween = (userId: string, from: Date, to: Date) =>
  prisma.transaction.findMany({
    where: { userId, date: { gte: from, lt: to } },
    select: { date: true, type: true, totalAmount: true, categoryGroup: true, source: true },
  });

// ---------------------------------------------------------------------------
// GET ?period=YYYY-MM | ?year=YYYY  [&kind=expense|income]
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const sp = new URL(req.url).searchParams;
    const kind = parseKind(sp.get("kind"));
    if (!kind) return fail("kind phải là expense hoặc income");
    const userId = user.id;
    const currentMonth = monthKeyOf(new Date());

    // Danh mục (nhóm cha) cùng loại — để hiện cả nhóm CHƯA đặt ngân sách.
    const categories = await prisma.category.findMany({
      where: { userId, kind: categoryKindOfBudget(kind), parentId: null, active: true },
      orderBy: { name: "asc" },
      select: { name: true, nameVi: true },
    });
    const nameVi: Record<string, string | null> = Object.fromEntries(categories.map((c) => [c.name, c.nameVi]));

    // ---- Cả năm ----
    const yearParam = sp.get("year");
    if (yearParam !== null) {
      if (!isYearKey(yearParam)) return fail("year phải có dạng YYYY");
      const y = Number(yearParam);
      const [budgets, txs] = await Promise.all([
        prisma.budget.findMany({
          where: { userId, kind, periodType: "monthly", period: { startsWith: `${yearParam}-` } },
          select: { period: true, categoryGroup: true, amount: true },
        }),
        txBetween(userId, new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y + 1, 0, 1))),
      ]);
      const evaluation = evaluateYear(kind, yearParam, budgets, actualsByMonth(txs, kind), currentMonth);
      for (const g of evaluation.groups) if (!(g.group in nameVi)) nameVi[g.group] = null;
      return NextResponse.json({ success: true, data: { kind, year: yearParam, currentMonth, nameVi, evaluation } });
    }

    // ---- Một tháng ----
    const period = sp.get("period") ?? currentMonth;
    if (!isMonthKey(period)) return fail("period phải có dạng YYYY-MM");
    const y = Number(period.slice(0, 4));
    const m = Number(period.slice(5, 7));
    const prev = shiftMonth(period, -1);

    const [rows, txs, prevCount] = await Promise.all([
      prisma.budget.findMany({ where: { userId, kind, periodType: "monthly", period } }),
      txBetween(userId, new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(y, m, 1))),
      prisma.budget.count({ where: { userId, kind, periodType: "monthly", period: prev } }),
    ]);

    const evaluation = evaluateMonth(kind, period, rows, actualsByGroup(txs, kind));
    const rowOf = new Map(rows.map((r) => [r.categoryGroup, r]));
    const evalOf = new Map(evaluation.groups.map((g) => [g.group, g]));

    // Hàng = nhóm đang bật ∪ nhóm có ngân sách ∪ nhóm có thực tế.
    const names = new Set<string>([...categories.map((c) => c.name), ...evalOf.keys()]);
    const list = [...names].map((group) => {
      const g = evalOf.get(group);
      const row = rowOf.get(group);
      return {
        id: row?.id ?? null,
        group,
        nameVi: nameVi[group] ?? null,
        budget: g?.budget ?? 0,
        actual: g?.actual ?? 0,
        remaining: g?.remaining ?? 0,
        pct: g?.pct ?? null,
        level: g?.level ?? levelOf(kind, 0, 0),
        unbudgeted: !row,
        notes: row?.notes ?? null,
        // Nhóm đã tắt nhưng vẫn có ngân sách/thực tế thì vẫn hiện, đánh dấu để UI biết.
        inactive: !(group in nameVi),
      };
    });
    list.sort((a, b) => Number(b.budget > 0) - Number(a.budget > 0) || b.budget - a.budget || b.actual - a.actual || a.group.localeCompare(b.group));

    return NextResponse.json({
      success: true,
      data: {
        kind,
        period,
        currentMonth,
        rows: list,
        totals: {
          budget: evaluation.totalBudget,
          actual: evaluation.totalActual,
          unbudgetedActual: evaluation.unbudgetedActual,
          remaining: evaluation.remaining,
          pct: evaluation.pct,
          level: evaluation.level,
        },
        overGroups: evaluation.overGroups.map((g) => g.group),
        previous: { period: prev, count: prevCount },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    console.error("Budgets GET error:", error);
    return fail(message, 500);
  }
}

// ---------------------------------------------------------------------------
// PUT {period, kind, items:[{group, amount, notes?}]} — upsert nhiều nhóm của MỘT tháng
// ---------------------------------------------------------------------------
export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json().catch(() => null);
    const kind = parseKind(body?.kind ?? null);
    if (!kind) return fail("kind phải là expense hoặc income");
    const period = String(body?.period ?? "");
    if (!isMonthKey(period)) return fail("period phải có dạng YYYY-MM");
    if (!Array.isArray(body?.items) || body.items.length === 0) return fail("Thiếu items");
    if (body.items.length > 200) return fail("Quá nhiều dòng");

    // Tên nhóm phải khớp đúng một danh mục cùng loại — chuỗi lạ là nhóm mồ côi
    // mà dashboard không bao giờ gộp được.
    const cats = await prisma.category.findMany({
      where: { userId: user.id, kind: categoryKindOfBudget(kind), parentId: null },
      select: { name: true },
    });
    const valid = new Set(cats.map((c) => c.name));

    const writes: ReturnType<typeof prisma.budget.upsert>[] = [];
    const seen = new Set<string>();
    for (const it of body.items) {
      const group = String(it?.group ?? "");
      if (!valid.has(group)) return fail(`Nhóm "${group}" không có trong danh mục ${kind === "expense" ? "chi" : "thu"}`);
      if (seen.has(group)) return fail(`Nhóm "${group}" xuất hiện hai lần`);
      seen.add(group);

      // Ô để trống: bỏ qua, không đụng dòng đang có. Xoá thì dùng DELETE.
      if (it.amount === null || it.amount === undefined || it.amount === "") continue;
      const amount = Math.round(Number(it.amount));
      if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
        return fail(`Số tiền của "${group}" không hợp lệ (0 – ${MAX_AMOUNT.toLocaleString("en-US")})`);
      }
      const notes = it.notes === undefined ? undefined : String(it.notes ?? "").trim().slice(0, 200) || null;

      writes.push(
        prisma.budget.upsert({
          where: {
            userId_periodType_period_kind_categoryGroup: {
              userId: user.id, periodType: "monthly", period, kind, categoryGroup: group,
            },
          },
          create: { userId: user.id, periodType: "monthly", period, kind, categoryGroup: group, amount, notes: notes ?? null },
          update: { amount, ...(notes !== undefined ? { notes } : {}) },
        })
      );
    }
    if (writes.length === 0) return fail("Không có số tiền nào để lưu");

    const saved = await prisma.$transaction(writes);
    return NextResponse.json({ success: true, data: { period, kind, saved: saved.length } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    console.error("Budgets PUT error:", error);
    return fail(message, 500);
  }
}

// ---------------------------------------------------------------------------
// POST {action:"copy", from?, to, kind, overwrite?} — chép ngân sách sang một tháng
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json().catch(() => null);
    if (body?.action !== "copy") return fail('action phải là "copy"');
    const kind = parseKind(body?.kind ?? null);
    if (!kind) return fail("kind phải là expense hoặc income");
    const to = String(body?.to ?? "");
    if (!isMonthKey(to)) return fail("to phải có dạng YYYY-MM");
    const from = body?.from ? String(body.from) : shiftMonth(to, -1);
    if (!isMonthKey(from)) return fail("from phải có dạng YYYY-MM");
    if (from === to) return fail("Tháng nguồn và tháng đích trùng nhau");

    const where = { userId: user.id, kind, periodType: "monthly" } as const;
    const [source, target] = await Promise.all([
      prisma.budget.findMany({ where: { ...where, period: from } }),
      prisma.budget.findMany({ where: { ...where, period: to } }),
    ]);
    if (source.length === 0) return fail(`Tháng ${from} chưa có ngân sách để chép`, 404);

    const plan = planCopy(source, target, body?.overwrite === true);
    if (plan.length > 0) {
      await prisma.$transaction(
        plan.map((p) =>
          prisma.budget.upsert({
            where: {
              userId_periodType_period_kind_categoryGroup: {
                userId: user.id, periodType: "monthly", period: to, kind, categoryGroup: p.categoryGroup,
              },
            },
            create: { userId: user.id, periodType: "monthly", period: to, kind, categoryGroup: p.categoryGroup, amount: p.amount },
            update: { amount: p.amount },
          })
        )
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        from, to, kind,
        created: plan.filter((p) => p.action === "create").length,
        updated: plan.filter((p) => p.action === "update").length,
        kept: source.length - plan.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    console.error("Budgets copy error:", error);
    return fail(message, 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE ?id=… — xoá ĐÚNG MỘT dòng ngân sách (của người dùng này)
// ---------------------------------------------------------------------------
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return fail("Thiếu id");
    const res = await prisma.budget.deleteMany({ where: { id, userId: user.id } });
    if (res.count === 0) return fail("Không tìm thấy dòng ngân sách", 404);
    return NextResponse.json({ success: true, data: { deleted: res.count } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    console.error("Budgets DELETE error:", error);
    return fail(message, 500);
  }
}
