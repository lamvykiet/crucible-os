export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Phân tích nợ, đọc thẳng từ lịch trả nợ.
//
// Endpoint `/api/finance/debts` chỉ trả về ảnh chụp hiện tại: dư nợ, trả hàng
// tháng, phần trăm đã trả. Ba câu quan trọng nhất thì không có:
//
//   - Bao giờ hết nợ?
//   - Từ nay tới đó còn phải trả bao nhiêu TIỀN LÃI?
//   - Trong khoản trả mỗi tháng, bao nhiêu là gốc và bao nhiêu là lãi?
//
// Cả ba đều nằm sẵn trong `DebtSchedule` — bảng đã có đủ 240 và 96 kỳ, tách
// riêng gốc với lãi — chỉ là chưa chỗ nào đọc tới.

const OTHER_KEY = "__other";

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const debts = await prisma.debt.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { remaining: "desc" }],
      include: {
        schedule: {
          orderBy: { period: "asc" },
          select: {
            period: true,
            dueDate: true,
            principal: true,
            interest: true,
            payment: true,
            closingBalance: true,
            status: true,
          },
        },
      },
    });

    if (debts.length === 0) {
      return NextResponse.json({ success: true, data: { hasData: false } });
    }

    const nowMonth = monthKey(new Date());

    // --- Từng khoản ---
    const rows = debts.map((d, i) => {
      const paid = d.schedule.filter((s) => s.status === "paid");
      const left = d.schedule.filter((s) => s.status !== "paid");
      const interestPaid = paid.reduce((s, x) => s + x.interest, 0);
      const interestLeft = left.reduce((s, x) => s + x.interest, 0);
      const next = left[0] || null;
      const last = d.schedule[d.schedule.length - 1] || null;
      return {
        id: d.id,
        name: d.name,
        type: d.type,
        status: d.status,
        principal: d.principal,
        remaining: d.remaining,
        monthlyPayment: d.monthlyPayment,
        interestRate: d.interestRate,
        colourIndex: i < 4 ? i : 4,
        paidPeriods: paid.length,
        totalPeriods: d.schedule.length,
        periodsLeft: left.length,
        interestPaid,
        interestLeft,
        /** Tổng còn phải trả = gốc còn lại + lãi còn lại. */
        totalLeft: left.reduce((s, x) => s + x.payment, 0),
        payoffDate: last ? last.dueDate.toISOString().slice(0, 10) : null,
        nextDue: next
          ? {
              period: next.period,
              dueDate: next.dueDate.toISOString().slice(0, 10),
              payment: next.payment,
              principal: next.principal,
              interest: next.interest,
            }
          : null,
        paidPct:
          d.principal > 0 ? Math.round(((d.principal - d.remaining) / d.principal) * 100) : 0,
        hasSchedule: d.schedule.length > 0,
      };
    });

    const named = rows.slice(0, 4);
    const tailUsed = rows.length > named.length;
    const balanceKeys = tailUsed ? [...named.map((r) => r.id), OTHER_KEY] : named.map((r) => r.id);

    // --- Trục tháng chung: từ kỳ đầu tiên tới kỳ cuối cùng của mọi khoản ---
    const allPeriods = debts.flatMap((d) => d.schedule);
    const months: string[] = [];
    if (allPeriods.length > 0) {
      const from = monthKey(
        allPeriods.reduce((a, b) => (a.dueDate < b.dueDate ? a : b)).dueDate
      );
      const to = monthKey(allPeriods.reduce((a, b) => (a.dueDate > b.dueDate ? a : b)).dueDate);
      let cur = from;
      while (cur <= to) {
        months.push(cur);
        const y = Number(cur.slice(0, 4));
        const m = Number(cur.slice(5, 7));
        cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      }
    }

    // --- Dư nợ còn lại theo tháng, tới ngày hết nợ ---
    //
    // Tháng không có kỳ nào của một khoản thì giữ nguyên dư nợ của tháng trước,
    // không để 0 — khoản vay trả quý mà vẽ tụt về 0 rồi nhảy lên lại là đồ thị
    // răng cưa vô nghĩa.
    const balanceSeries = months.map((name) => {
      const row: Record<string, string | number> = { name, total: 0 };
      for (const key of balanceKeys) row[key] = 0;
      return row;
    });

    for (const d of debts) {
      const key = named.some((n) => n.id === d.id) ? d.id : OTHER_KEY;
      let running = d.principal;
      let cursor = 0;
      for (let i = 0; i < months.length; i++) {
        while (
          cursor < d.schedule.length &&
          monthKey(d.schedule[cursor].dueDate) <= months[i]
        ) {
          running = d.schedule[cursor].closingBalance;
          cursor++;
        }
        // Trước kỳ đầu tiên của khoản này thì chưa vay — để 0, đừng vẽ một
        // khoản nợ tồn tại trước khi nó ra đời.
        const started = monthKey(d.schedule[0]?.dueDate ?? new Date()) <= months[i];
        const v = started ? Math.max(0, running) : 0;
        balanceSeries[i][key] = (balanceSeries[i][key] as number) + v;
        balanceSeries[i].total = (balanceSeries[i].total as number) + v;
      }
    }

    // --- Mỗi năm trả bao nhiêu gốc, bao nhiêu lãi ---
    //
    // Theo NĂM chứ không theo tháng: cả đời hai khoản vay là hơn 240 tháng, vẽ
    // từng tháng thì cột mảnh như sợi chỉ. Theo năm còn cho thấy đúng thứ đáng
    // thấy — tỷ lệ lãi/gốc đảo chiều rất chậm.
    const byYear = new Map<number, { principal: number; interest: number; paid: boolean }>();
    for (const s of allPeriods) {
      const y = s.dueDate.getUTCFullYear();
      const cur = byYear.get(y) || { principal: 0, interest: 0, paid: true };
      cur.principal += s.principal;
      cur.interest += s.interest;
      if (s.status !== "paid") cur.paid = false;
      byYear.set(y, cur);
    }
    const principalVsInterest = [...byYear.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, v]) => ({
        name: String(year),
        principal: v.principal,
        interest: v.interest,
        total: v.principal + v.interest,
        share: v.principal + v.interest > 0
          ? Math.round((v.interest / (v.principal + v.interest)) * 100)
          : 0,
      }));

    // --- Mười hai kỳ tới, tách theo khoản ---
    const upcomingMonths = months.filter((m) => m >= nowMonth).slice(0, 12);
    const next12 = upcomingMonths.map((name) => {
      const row: Record<string, string | number> = { name, total: 0 };
      for (const key of balanceKeys) row[key] = 0;
      return row;
    });
    const upIndex = new Map(upcomingMonths.map((m, i) => [m, i]));
    for (const d of debts) {
      const key = named.some((n) => n.id === d.id) ? d.id : OTHER_KEY;
      for (const s of d.schedule) {
        const idx = upIndex.get(monthKey(s.dueDate));
        if (idx === undefined) continue;
        next12[idx][key] = (next12[idx][key] as number) + s.payment;
        next12[idx].total = (next12[idx].total as number) + s.payment;
      }
    }

    // --- Đã trả thật so với kế hoạch, 12 tháng gần nhất ---
    //
    // `planned` lấy từ lịch, `actual` lấy từ giao dịch có `source = "debt"`.
    // Hai con số này lệch nhau là tín hiệu sớm nhất của việc trả trễ hoặc trả
    // thừa, mà không màn hình nào trong app đang nói ra.
    const pastMonths = months.filter((m) => m < nowMonth).slice(-12);
    const plannedBy = new Map<string, number>();
    for (const s of allPeriods) {
      const k = monthKey(s.dueDate);
      plannedBy.set(k, (plannedBy.get(k) || 0) + s.payment);
    }
    const firstPast = pastMonths[0];
    const actualRows = firstPast
      ? await prisma.transaction.findMany({
          where: {
            userId: user.id,
            source: "debt",
            date: { gte: new Date(`${firstPast}-01T00:00:00.000Z`) },
          },
          select: { date: true, totalAmount: true },
        })
      : [];
    const actualBy = new Map<string, number>();
    for (const r of actualRows) {
      const k = monthKey(r.date);
      actualBy.set(k, (actualBy.get(k) || 0) + r.totalAmount);
    }
    const actualVsPlan = pastMonths.map((name) => ({
      name,
      planned: plannedBy.get(name) || 0,
      actual: actualBy.get(name) || 0,
    }));

    // --- Tổng ---
    const outstanding = rows.reduce((s, r) => s + r.remaining, 0);
    const principalTotal = rows.reduce((s, r) => s + r.principal, 0);
    const interestPaid = rows.reduce((s, r) => s + r.interestPaid, 0);
    const interestLeft = rows.reduce((s, r) => s + r.interestLeft, 0);
    const payoff = rows
      .map((r) => r.payoffDate)
      .filter(Boolean)
      .sort()
      .pop() as string | undefined;

    return NextResponse.json({
      success: true,
      data: {
        hasData: true,
        nowMonth,
        months,
        balanceSeries,
        balanceKeys,
        principalVsInterest,
        next12,
        actualVsPlan,
        debts: rows,
        otherKey: OTHER_KEY,
        totals: {
          outstanding,
          principalTotal,
          principalPaid: principalTotal - outstanding,
          interestPaid,
          interestLeft,
          /** Gốc còn lại + lãi còn lại: con số thật sự còn phải móc ra. */
          totalLeft: outstanding + interestLeft,
          monthlyPayment: rows
            .filter((r) => r.status === "active")
            .reduce((s, r) => s + r.monthlyPayment, 0),
          payoffDate: payoff || null,
          monthsLeft: Math.max(...rows.map((r) => r.periodsLeft), 0),
          weightedRate:
            outstanding > 0
              ? rows.reduce((s, r) => s + r.remaining * r.interestRate, 0) / outstanding
              : 0,
          activeCount: rows.filter((r) => r.status === "active").length,
          settledCount: rows.filter((r) => r.status !== "active").length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Debt analysis error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
