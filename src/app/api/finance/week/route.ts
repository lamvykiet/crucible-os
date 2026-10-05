export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Hôm nay, hôm qua, và cả tuần — trong một lần hỏi.
//
// Dashboard vốn chạy theo THÁNG. Nhưng người ghi sổ thường ghi vào buổi tối,
// lúc không còn sức đọc một trang đầy biểu đồ cả tháng; cái cần lúc đó chỉ là
// "hôm nay tiêu gì, hôm qua tiêu gì, tuần này đang đi về đâu". Một tuần lại
// hay nằm vắt qua hai tháng, nên không mượn được endpoint tháng.
//
// Tuần bắt đầu THỨ HAI, cùng quy ước với bộ chọn ngày của dự án.

type Bucket = "income" | "expense" | "refund" | "ignored";

function classify(type: string): Bucket {
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

const DAY = 24 * 60 * 60 * 1000;

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Thứ Hai của tuần chứa `iso`, theo lịch (không giờ). */
function mondayOf(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay: 0 = Chủ nhật. Lùi về thứ Hai nên Chủ nhật phải lùi 6 ngày chứ
  // không phải tiến 1 — bẫy kinh điển của tuần bắt đầu thứ Hai.
  const back = (at.getUTCDay() + 6) % 7;
  return new Date(at.getTime() - back * DAY);
}

interface Row {
  date: Date;
  type: string;
  totalAmount: number;
  supplier: string;
  categoryGroup: string;
  subGroup: string | null;
  source: string;
}

/** Gộp một nhóm giao dịch thành bộ số dùng chung cho mọi thẻ. */
function summarise(rows: Row[]) {
  let income = 0;
  let expense = 0;
  let debtPrincipal = 0;
  for (const t of rows) {
    const b = classify(t.type);
    if (b === "income") income += t.totalAmount;
    else if (b === "expense") expense += t.totalAmount;
    else if (b === "refund") expense -= t.totalAmount;
    // Trả gốc không phải chi tiêu, nhưng tiền vẫn rời tài khoản — tách riêng,
    // cùng quy ước với endpoint dashboard.
    else if (t.source === "debt") debtPrincipal += t.totalAmount;
  }
  return {
    income,
    expense,
    debtPrincipal,
    cashOut: expense + debtPrincipal,
    net: income - expense - debtPrincipal,
    count: rows.length,
  };
}

function topGroups(rows: Row[], limit: number) {
  const map = new Map<string, { amount: number; count: number }>();
  for (const t of rows) {
    const b = classify(t.type);
    if (b !== "expense" && b !== "refund") continue;
    const key = t.categoryGroup || "Other";
    const cur = map.get(key) || { amount: 0, count: 0 };
    cur.amount += b === "refund" ? -t.totalAmount : t.totalAmount;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .filter((g) => g.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const param = searchParams.get("today");
    // Ngày "hôm nay" do client gửi lên theo lịch máy người dùng. Tự lấy ở server
    // thì từ 00:00 đến 07:00 giờ Việt Nam sẽ ra ngày hôm trước — xem lib/localDate.
    const todayIso =
      param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : new Date().toISOString().slice(0, 10);

    const [y, m, d] = todayIso.split("-").map(Number);
    const today = new Date(Date.UTC(y, m - 1, d));
    const yesterday = new Date(today.getTime() - DAY);
    const weekStart = mondayOf(todayIso);
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY);
    const prevWeekStart = new Date(weekStart.getTime() - 7 * DAY);
    // Mười hai tuần để vẽ xu hướng; lấy luôn trong một truy vấn.
    const windowStart = new Date(weekStart.getTime() - 11 * 7 * DAY);

    const rows = (await prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: windowStart, lt: weekEnd } },
      select: {
        date: true,
        type: true,
        totalAmount: true,
        supplier: true,
        categoryGroup: true,
        subGroup: true,
        source: true,
      },
      orderBy: { date: "asc" },
    })) as Row[];

    const inRange = (t: Row, from: Date, to: Date) => t.date >= from && t.date < to;

    const todayRows = rows.filter((t) => inRange(t, today, new Date(today.getTime() + DAY)));
    const yesterdayRows = rows.filter((t) =>
      inRange(t, yesterday, new Date(yesterday.getTime() + DAY))
    );
    const weekRows = rows.filter((t) => inRange(t, weekStart, weekEnd));
    const prevWeekRows = rows.filter((t) => inRange(t, prevWeekStart, weekStart));

    // --- Bảy ngày của tuần này, đặt cạnh đúng ngày đó của tuần trước ---
    const days = Array.from({ length: 7 }, (_, i) => {
      const at = new Date(weekStart.getTime() + i * DAY);
      const prev = new Date(prevWeekStart.getTime() + i * DAY);
      const atRows = rows.filter((t) => inRange(t, at, new Date(at.getTime() + DAY)));
      const prevRows = rows.filter((t) => inRange(t, prev, new Date(prev.getTime() + DAY)));
      const s = summarise(atRows);
      return {
        date: dayKey(at),
        weekday: i, // 0 = thứ Hai
        expense: s.cashOut,
        income: s.income,
        count: s.count,
        lastWeek: summarise(prevRows).cashOut,
        // Ngày chưa tới thì cột trống là đương nhiên; client cần biết để không
        // tô cảnh báo "chưa ghi sổ" lên đó.
        future: dayKey(at) > todayIso,
        isToday: dayKey(at) === todayIso,
      };
    });

    // --- Mười hai tuần gần nhất ---
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const from = new Date(windowStart.getTime() + i * 7 * DAY);
      const to = new Date(from.getTime() + 7 * DAY);
      const s = summarise(rows.filter((t) => inRange(t, from, to)));
      return {
        name: dayKey(from).slice(5), // MM-DD
        from: dayKey(from),
        expense: s.cashOut,
        income: s.income,
        count: s.count,
        current: from.getTime() === weekStart.getTime(),
      };
    });

    // Trung bình mỗi thứ trong tuần, gộp 11 tuần đã trọn vẹn. Tuần đang chạy
    // chưa đủ ngày nên để ngoài, nếu không thứ Bảy/Chủ nhật của tuần này bị
    // tính là 0 và kéo trung bình xuống.
    const weekdayTotals = Array.from({ length: 7 }, () => ({ sum: 0, weeks: 0 }));
    for (let w = 0; w < 11; w++) {
      const base = new Date(windowStart.getTime() + w * 7 * DAY);
      for (let i = 0; i < 7; i++) {
        const at = new Date(base.getTime() + i * DAY);
        const s = summarise(rows.filter((t) => inRange(t, at, new Date(at.getTime() + DAY))));
        weekdayTotals[i].sum += s.cashOut;
        weekdayTotals[i].weeks += 1;
      }
    }
    const weekdayAverage = weekdayTotals.map((v, i) => ({
      weekday: i,
      avg: v.weeks > 0 ? Math.round(v.sum / v.weeks) : 0,
    }));

    const detail = (rows2: Row[]) =>
      rows2
        .filter((t) => classify(t.type) !== "ignored" || t.source === "debt")
        .map((t) => ({
          supplier: t.supplier || "",
          type: t.type,
          categoryGroup: t.categoryGroup || "",
          subGroup: t.subGroup || "",
          totalAmount: t.totalAmount,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

    // Ngày trong tuần đã trôi qua mà không có khoản nào. Không khẳng định là
    // "quên ghi" — có ngày thật sự không tiêu đồng nào — nhưng đáng để liếc.
    const blankDays = days.filter((d2) => !d2.future && d2.count === 0).map((d2) => d2.date);

    return NextResponse.json({
      success: true,
      data: {
        today: { date: todayIso, ...summarise(todayRows), items: detail(todayRows) },
        yesterday: {
          date: dayKey(yesterday),
          ...summarise(yesterdayRows),
          items: detail(yesterdayRows),
        },
        week: {
          from: dayKey(weekStart),
          to: dayKey(new Date(weekEnd.getTime() - DAY)),
          ...summarise(weekRows),
          topGroups: topGroups(weekRows, 6),
          /** Số ngày đã trôi qua trong tuần, để tính trung bình cho đúng. */
          elapsedDays: days.filter((d2) => !d2.future).length,
        },
        prevWeek: summarise(prevWeekRows),
        days,
        weeks,
        weekdayAverage,
        blankDays,
        hasData: rows.length > 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("Week endpoint error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
