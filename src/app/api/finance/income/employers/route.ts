export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Thu nhập nhìn theo CẢ SỰ NGHIỆP, không theo tháng báo cáo.
//
// `/api/finance/income` trả lời "tháng này / năm này thu bao nhiêu". Câu còn
// thiếu là câu dài hơn: từng nơi đã làm trả bao nhiêu, lương và thưởng chia thế
// nào, lương đi lên hay đi ngang qua từng chặng, và giữa hai chặng hụt mất mấy
// tháng. Những câu đó không nằm trong cửa sổ 12 tháng.
//
// Công ty lấy từ cột `supplier` của giao dịch Income — đó là nơi trả tiền.
// Lương/thưởng lấy từ `subGroup`. Không bịa thêm bảng: dữ liệu đã đủ.

const OTHER_KEY = "__other";

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

/** "2024-03" + 1 → "2024-04". Cộng tháng bằng chuỗi để khỏi lệch múi giờ. */
function shiftMonth(key: string, n: number) {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7)) - 1 + n;
  const ny = y + Math.floor(m / 12);
  const nm = ((m % 12) + 12) % 12;
  return `${ny}-${String(nm + 1).padStart(2, "0")}`;
}

/** Số tháng từ a tới b, tính cả hai đầu. */
function spanMonths(a: string, b: string) {
  const ya = Number(a.slice(0, 4));
  const ma = Number(a.slice(5, 7));
  const yb = Number(b.slice(0, 4));
  const mb = Number(b.slice(5, 7));
  return (yb - ya) * 12 + (mb - ma) + 1;
}

function isIncome(type: string) {
  return type?.trim().toLowerCase() === "income";
}

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const rows = await prisma.transaction.findMany({
      where: { userId: user.id },
      select: { date: true, type: true, totalAmount: true, supplier: true, subGroup: true },
      orderBy: { date: "asc" },
    });
    const incomes = rows.filter((t) => isIncome(t.type));

    if (incomes.length === 0) {
      return NextResponse.json({ success: true, data: { hasData: false } });
    }

    const nowMonth = monthKey(new Date());
    const firstMonth = monthKey(incomes[0].date);
    const lastMonth = monthKey(incomes[incomes.length - 1].date);
    // Trục chạy tới tháng hiện tại chứ không dừng ở khoản thu cuối: khoảng
    // trống ở cuối cũng là một dữ kiện, cắt đi là giấu nó.
    const axisEnd = nowMonth > lastMonth ? nowMonth : lastMonth;

    const months: string[] = [];
    for (let m = firstMonth; m <= axisEnd; m = shiftMonth(m, 1)) months.push(m);

    const employerOf = (s: string | null) => s?.trim() || "Không rõ";
    const subOf = (s: string | null) => s?.trim() || "Khác";

    // --- Gộp một lượt ---
    const totalByEmployer = new Map<string, number>();
    const totalBySub = new Map<string, number>();
    const byEmployerMonth = new Map<string, Map<string, number>>();
    const byEmployerSub = new Map<string, Map<string, number>>();
    const byEmployerYear = new Map<string, Map<number, number>>();
    const byYearEmployer = new Map<number, Map<string, number>>();
    const byYearSub = new Map<number, Map<string, number>>();
    const salaryByEmployerMonth = new Map<string, Map<string, number>>();
    const bonusByEmployerMonth = new Map<string, Map<string, number>>();
    const totalByMonth = new Map<string, number>();

    const bump = <K>(m: Map<K, number>, k: K, v: number) => m.set(k, (m.get(k) || 0) + v);
    const nest = <K>(m: Map<string, Map<K, number>>, outer: string) => {
      if (!m.has(outer)) m.set(outer, new Map());
      return m.get(outer)!;
    };

    for (const t of incomes) {
      const e = employerOf(t.supplier);
      const s = subOf(t.subGroup);
      const k = monthKey(t.date);
      const y = t.date.getUTCFullYear();
      const v = t.totalAmount;

      bump(totalByEmployer, e, v);
      bump(totalBySub, s, v);
      bump(totalByMonth, k, v);
      bump(nest(byEmployerMonth, e), k, v);
      bump(nest(byEmployerSub, e), s, v);
      bump(nest(byEmployerYear, e), y, v);
      if (!byYearEmployer.has(y)) byYearEmployer.set(y, new Map());
      bump(byYearEmployer.get(y)!, e, v);
      if (!byYearSub.has(y)) byYearSub.set(y, new Map());
      bump(byYearSub.get(y)!, s, v);
      // "Lương" là khoản ĐỀU ĐẶN; thưởng nhảy một cục làm hỏng mọi so sánh về
      // mức sống hàng tháng, nên đường lương tính riêng.
      if (s.toLowerCase() === "salary" || s.toLowerCase() === "lương") {
        bump(nest(salaryByEmployerMonth, e), k, v);
      } else {
        bump(nest(bonusByEmployerMonth, e), k, v);
      }
    }

    // --- Từng nơi đã làm ---
    // THỨ TỰ HIỂN THỊ: mới nhất trước. Xếp theo tổng tiền thì nơi làm lâu nhất
    // luôn đứng đầu, mà đọc một dòng thời gian thì thứ muốn thấy trước là chỗ
    // đang làm.
    const lastMonthOf = (e: string) =>
      [...(byEmployerMonth.get(e)?.keys() || [])].sort().pop() || "";
    const employerNames = [...totalByEmployer.keys()].sort((a, b) =>
      lastMonthOf(b).localeCompare(lastMonthOf(a))
    );

    // GÁN MÀU: theo tổng tiền, KHÔNG theo thứ tự hiển thị. Dải --chart-* đi từ
    // đất nung đậm tới nâu rất nhạt, nên bậc 4 (và bậc nhạt của nó dành cho
    // thưởng) gần như chìm vào nền thẻ. Gán theo thứ tự hiển thị thì nơi làm
    // lâu nhất — chiếm nửa biểu đồ — có thể rơi đúng vào bậc nhạt nhất. Nơi trả
    // nhiều nhất nhận bậc đậm nhất; màu chỉ là nhãn, ai mang màu nào không
    // quan trọng, nhưng đọc được hay không thì quan trọng.
    const byTotalDesc = [...totalByEmployer.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n);
    const colourIndexOf = (name: string) => {
      const i = byTotalDesc.indexOf(name);
      return i >= 0 && i < 4 ? i : 4;
    };

    const employers = employerNames.map((name) => {
      const perMonth = byEmployerMonth.get(name)!;
      const paidMonths = [...perMonth.keys()].sort();
      const from = paidMonths[0];
      const to = paidMonths[paidMonths.length - 1];
      const tenure = spanMonths(from, to);
      const total = totalByEmployer.get(name)!;

      const subs = [...(byEmployerSub.get(name) || new Map()).entries()]
        .map(([sub, amount]) => ({ sub, amount, share: Math.round((amount / total) * 100) }))
        .sort((a, b) => b.amount - a.amount);

      const salaryMonths = [...(salaryByEmployerMonth.get(name) || new Map()).entries()].sort(
        (a, b) => a[0].localeCompare(b[0])
      );
      const salaryTotal = salaryMonths.reduce((s, [, v]) => s + v, 0);
      const firstSalary = salaryMonths[0]?.[1] ?? 0;
      const lastSalary = salaryMonths[salaryMonths.length - 1]?.[1] ?? 0;

      const best = [...perMonth.entries()].sort((a, b) => b[1] - a[1])[0];

      return {
        name,
        colourIndex: colourIndexOf(name),
        from,
        to,
        /** Khoảng thời gian gắn bó, tính cả hai đầu. */
        tenure,
        /** Số tháng thực sự có tiền về — lệch với `tenure` là có tháng hụt. */
        paid: paidMonths.length,
        total,
        subs,
        salaryTotal,
        bonusTotal: total - salaryTotal,
        /** Chia cho số tháng gắn bó, không phải số tháng có tiền: đây mới là
         *  mức thật sự sống được trong giai đoạn đó. */
        avgPerMonth: Math.round(total / tenure),
        avgSalaryPerMonth:
          salaryMonths.length > 0 ? Math.round(salaryTotal / salaryMonths.length) : 0,
        firstSalary,
        lastSalary,
        salaryGrowthPct:
          firstSalary > 0 ? Math.round(((lastSalary - firstSalary) / firstSalary) * 100) : null,
        best: best ? { month: best[0], amount: best[1] } : null,
        byYear: [...(byEmployerYear.get(name) || new Map()).entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([year, amount]) => ({ year, amount })),
        /** Còn đang nhận tiền từ nơi này (trong vòng 2 tháng gần nhất). */
        active: spanMonths(to, nowMonth) <= 2,
      };
    });

    // Bốn cột màu riêng, phần đuôi gộp — giống mọi biểu đồ chồng khác trong dự
    // án: dải --chart-* chỉ tách bạch được bốn bậc đầu.
    // Bốn nơi lớn nhất có màu riêng; phần đuôi gộp. Giữ thứ tự hiển thị để
    // khúc cột xếp chồng cùng chiều với danh sách bên trên.
    const namedSet = new Set(byTotalDesc.slice(0, 4));
    const namedEmployers = employerNames.filter((n) => namedSet.has(n));
    const employerTailUsed = employerNames.length > namedEmployers.length;
    const employerKeys = employerTailUsed ? [...namedEmployers, OTHER_KEY] : namedEmployers;
    /** Cho hai biểu đồ theo năm: khoá nào mang màu nào. */
    const employerSeries = employerKeys.map((key) => ({
      key,
      colourIndex: key === OTHER_KEY ? 4 : colourIndexOf(key),
    }));

    const subNames = [...totalBySub.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n);
    const namedSubs = subNames.slice(0, 4);
    const subTailUsed = subNames.length > namedSubs.length;
    const subKeys = subTailUsed ? [...namedSubs, OTHER_KEY] : namedSubs;

    const years = [...byYearEmployer.keys()].sort((a, b) => a - b);

    const fold = (bucket: Map<string, number>, named: string[]) => {
      const row: Record<string, number> = {};
      for (const k of named) row[k] = 0;
      let tail = 0;
      for (const [k, v] of bucket) {
        if (named.includes(k)) row[k] += v;
        else tail += v;
      }
      if (tail > 0) row[OTHER_KEY] = tail;
      return row;
    };

    const yearByEmployer = years.map((y) => {
      const bucket = byYearEmployer.get(y)!;
      const row = fold(bucket, namedEmployers);
      return {
        name: String(y),
        total: [...bucket.values()].reduce((s, v) => s + v, 0),
        ...row,
      };
    });

    const yearBySub = years.map((y) => {
      const bucket = byYearSub.get(y)!;
      const row = fold(bucket, namedSubs);
      const total = [...bucket.values()].reduce((s, v) => s + v, 0);
      return { name: String(y), total, ...row };
    });

    // --- Dòng thời gian từng tháng, tách theo nơi trả VÀ theo lương/thưởng ---
    //
    // Mỗi nơi hai khoá: lương và thưởng. Gộp làm một thì tháng có thưởng chỉ là
    // một cột vọt lên, không nói được vọt vì lương tăng hay vì một cục thưởng
    // không lặp lại — mà hai chuyện đó dẫn tới hai quyết định khác hẳn nhau.
    //
    // Khoá đánh theo SỐ THỨ TỰ của nơi làm, không ghép từ tên: tên công ty có
    // thể chứa bất cứ ký tự nào, ghép chuỗi là sớm muộn cũng đụng dấu phân cách.
    const timelineSeries = namedEmployers.flatMap((name, i) => [
      { key: `e${i}s`, employer: name, kind: "salary" as const, colourIndex: colourIndexOf(name) },
      { key: `e${i}b`, employer: name, kind: "bonus" as const, colourIndex: colourIndexOf(name) },
    ]);
    if (employerTailUsed) {
      timelineSeries.push({
        key: OTHER_KEY,
        employer: "",
        kind: "salary" as const,
        colourIndex: 4,
      });
    }

    const timeline = months.map((name) => {
      const row: Record<string, string | number | null> = { name, total: totalByMonth.get(name) || 0 };
      namedEmployers.forEach((e, i) => {
        row[`e${i}s`] = salaryByEmployerMonth.get(e)?.get(name) || 0;
        row[`e${i}b`] = bonusByEmployerMonth.get(e)?.get(name) || 0;
      });
      if (employerTailUsed) {
        let tail = 0;
        for (const e of employerNames.slice(4)) tail += byEmployerMonth.get(e)?.get(name) || 0;
        row[OTHER_KEY] = tail;
      }
      return row;
    });

    // Trung bình mỗi tháng, TÍNH CẢ tháng không có đồng nào. Đây là con số duy
    // nhất so được giữa các chặng: lương tháng thì chặng nào cũng đẹp, chỉ có
    // đường này mới cho thấy quãng thất nghiệp kéo mức sống xuống đâu.
    //
    // Mười một tháng đầu cửa sổ chưa đủ 12, nhưng bỏ trống thì cả năm đầu tiên
    // không có đường — đúng quãng đáng xem nhất lại trắng. Nên dùng cửa sổ nở
    // dần: lấy tất cả số tháng đã có, tối đa 12.
    for (let i = 0; i < timeline.length; i++) {
      const from = Math.max(0, i - 11);
      let sum = 0;
      for (let j = from; j <= i; j++) sum += Number(timeline[j].total) || 0;
      timeline[i].trailing12 = Math.round(sum / (i - from + 1));
    }

    // --- Những tháng không có đồng nào ---
    const gaps: { from: string; to: string; months: number }[] = [];
    let runFrom: string | null = null;
    for (const m of months) {
      // Tháng đang chạy chưa kết thúc, trống là chuyện bình thường.
      const empty = (totalByMonth.get(m) || 0) === 0 && m !== nowMonth;
      if (empty && !runFrom) runFrom = m;
      if (!empty && runFrom) {
        const prev = shiftMonth(m, -1);
        gaps.push({ from: runFrom, to: prev, months: spanMonths(runFrom, prev) });
        runFrom = null;
      }
    }
    if (runFrom) {
      const prev = shiftMonth(nowMonth, -1);
      if (prev >= runFrom) gaps.push({ from: runFrom, to: prev, months: spanMonths(runFrom, prev) });
    }

    const allTime = incomes.reduce((s, t) => s + t.totalAmount, 0);
    const monthsPaid = totalByMonth.size;
    const careerMonths = spanMonths(firstMonth, axisEnd);
    const gapMonths = gaps.reduce((s, g) => s + g.months, 0);

    return NextResponse.json({
      success: true,
      data: {
        hasData: true,
        firstMonth,
        lastMonth,
        nowMonth,
        months,
        employers,
        employerKeys,
        employerSeries,
        timelineSeries,
        subKeys,
        years,
        yearByEmployer,
        yearBySub,
        timeline,
        gaps,
        otherKey: OTHER_KEY,
        totals: {
          allTime,
          monthsPaid,
          careerMonths,
          gapMonths,
          /** Chia cho số tháng CÓ tiền về. */
          avgPerPaidMonth: monthsPaid > 0 ? Math.round(allTime / monthsPaid) : 0,
          /** Chia cho cả quãng đường, kể cả tháng trống. Khoảng cách giữa hai
           *  con số này chính là cái giá của những lần chuyển việc. */
          avgPerCareerMonth: careerMonths > 0 ? Math.round(allTime / careerMonths) : 0,
          employerCount: employerNames.length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Income employers error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
