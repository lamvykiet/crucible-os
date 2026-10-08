export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { normalizeSupplier } from "@/lib/invoice";

// Chi vào đâu, thu từ đâu: theo NƠI CHI (vendor) và theo NHÓM DANH MỤC, cho
// tháng báo cáo so với tháng trước, cùng tháng năm trước, và luỹ kế năm nay so
// với cùng kỳ năm trước.
//
// Cùng luật thu/chi với /api/finance/dashboard: Expense cộng vào chi, Refund
// TRỪ khỏi chi (tiền hoàn), Income là thu, Transfer/Adjustment bỏ qua. Lệch
// luật là con số ở đây không khớp thẻ "Chi tiêu tháng" ngay phía trên.
//
// Nơi chi gộp theo tên đã chuẩn hoá (bỏ dấu, bỏ hoa/thường, bỏ ký tự lạ): sổ
// đang có "BÁCH HÓA XANH" lẫn "Bách Hóa Xanh", "STARBUCKS" lẫn "Starbucks" —
// không gộp thì mỗi nơi bị chẻ đôi và tổng của nó thấp hơn thật.

interface Metrics {
  month: number;
  prev: number;
  lastYearMonth: number;
  ytd: number;
  lastYtd: number;
  lastYearTotal: number;
  /** Số giao dịch trong tháng báo cáo. */
  count: number;
  /** 12 tháng gần nhất, kết thúc ở tháng báo cáo. */
  trend: number[];
}

interface Row extends Metrics {
  key: string;
  name: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const param = new URL(req.url).searchParams.get("month") ?? "";
    const now = new Date();
    const [Y, M] = /^\d{4}-\d{2}$/.test(param)
      ? param.split("-").map(Number)
      : [now.getUTCFullYear(), now.getUTCMonth() + 1];

    const monthKey = `${Y}-${pad(M)}`;
    const prevKey = M === 1 ? `${Y - 1}-12` : `${Y}-${pad(M - 1)}`;
    const lastYearKey = `${Y - 1}-${pad(M)}`;
    const trendKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(Y, M - 1 - i, 1));
      trendKeys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
    }

    // Từ 01/01 năm trước tới hết tháng báo cáo: đủ cho cả luỹ kế cùng kỳ năm
    // trước, cả năm trước, lẫn chuỗi 12 tháng.
    const txs = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        type: { in: ["Expense", "Refund", "Income"] },
        date: { gte: new Date(Date.UTC(Y - 1, 0, 1)), lt: new Date(Date.UTC(Y, M, 1)) },
      },
      select: { date: true, type: true, supplier: true, categoryGroup: true, subGroup: true, totalAmount: true },
    });

    const blank = (): Metrics => ({
      month: 0, prev: 0, lastYearMonth: 0, ytd: 0, lastYtd: 0, lastYearTotal: 0, count: 0,
      trend: new Array(12).fill(0),
    });

    const add = (m: Metrics, mk: string, amount: number) => {
      const [y, mo] = mk.split("-").map(Number);
      if (mk === monthKey) { m.month += amount; m.count += 1; }
      if (mk === prevKey) m.prev += amount;
      if (mk === lastYearKey) m.lastYearMonth += amount;
      if (y === Y && mo <= M) m.ytd += amount;
      if (y === Y - 1) {
        m.lastYearTotal += amount;
        if (mo <= M) m.lastYtd += amount;
      }
      const ti = trendKeys.indexOf(mk);
      if (ti >= 0) m.trend[ti] += amount;
    };

    const sides = {
      expense: { totals: blank(), vendors: new Map<string, Row & { names: Map<string, number> }>(), groups: new Map<string, Row & { children: Map<string, Row> }>() },
      income: { totals: blank(), vendors: new Map<string, Row & { names: Map<string, number> }>(), groups: new Map<string, Row & { children: Map<string, Row> }>() },
    };

    for (const t of txs) {
      const side = t.type === "Income" ? sides.income : sides.expense;
      const amount = t.type === "Refund" ? -Math.abs(t.totalAmount) : Math.abs(t.totalAmount);
      const mk = t.date.toISOString().slice(0, 7);

      add(side.totals, mk, amount);

      const supplier = (t.supplier || "").trim() || "N/A";
      const vKey = normalizeSupplier(supplier) || "n a";
      let v = side.vendors.get(vKey);
      if (!v) {
        v = { key: vKey, name: supplier, names: new Map(), ...blank() };
        side.vendors.set(vKey, v);
      }
      v.names.set(supplier, (v.names.get(supplier) ?? 0) + 1);
      add(v, mk, amount);

      const gKey = t.categoryGroup || "Other";
      let g = side.groups.get(gKey);
      if (!g) {
        g = { key: gKey, name: gKey, children: new Map(), ...blank() };
        side.groups.set(gKey, g);
      }
      add(g, mk, amount);
      const cKey = t.subGroup || "";
      let c = g.children.get(cKey);
      if (!c) {
        c = { key: cKey, name: cKey, ...blank() };
        g.children.set(cKey, c);
      }
      add(c, mk, amount);
    }

    // Chỉ giữ dòng có số ở ít nhất một cột đang hiển thị; xếp theo tháng báo
    // cáo rồi tới luỹ kế năm — nơi tháng này chưa chi vẫn hiện nếu năm nay có.
    const meaningful = (r: Metrics) =>
      [r.month, r.prev, r.lastYearMonth, r.ytd, r.lastYtd].some((x) => x !== 0);
    const order = (a: Metrics, b: Metrics) =>
      b.month - a.month || b.ytd - a.ytd || b.lastYearTotal - a.lastYearTotal;

    const finish = (s: typeof sides.expense) => ({
      totals: s.totals,
      vendors: [...s.vendors.values()]
        .map(({ names, ...r }) => ({
          ...r,
          // Tên hiển thị: cách viết được dùng nhiều nhất.
          name: [...names.entries()].sort((a, b) => b[1] - a[1])[0][0],
          variants: names.size,
        }))
        .filter(meaningful)
        .sort(order),
      groups: [...s.groups.values()]
        .map(({ children, ...g }) => ({
          ...g,
          children: [...children.values()].filter(meaningful).sort(order),
        }))
        .filter(meaningful)
        .sort(order),
    });

    return NextResponse.json({
      success: true,
      data: {
        month: monthKey,
        prevMonth: prevKey,
        lastYearMonth: lastYearKey,
        year: Y,
        trendMonths: trendKeys,
        expense: finish(sides.expense),
        income: finish(sides.income),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
