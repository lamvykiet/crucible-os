export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  ASSET_CATEGORIES,
  accumulatedDepreciation,
  bookValue,
  currentWorth,
  equity,
  isSecured,
  monthlyDepreciation,
  remainingLifeMonths,
} from "@/lib/assets";

// Tài sản và công cụ dụng cụ.
//
// Dư nợ của khoản vay gắn với tài sản KHÔNG đọc từ `Debt.remaining` mà tính từ
// kỳ đã chốt gần nhất trong lịch trả nợ. Hai chỗ đó có thể lệch nhau, và lịch
// trả nợ mới là thứ có căn cứ từng kỳ.
//
// Một tài sản có thể gánh NHIỀU khoản vay — căn nhà vừa có khoản vay mua nhà
// vừa có khoản thế chấp lấy thêm tiền — nên dư nợ là TỔNG của tất cả.

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const now = new Date();
    const assets = await prisma.asset.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { acquisitionCost: "desc" }],
      include: {
        debts: {
          select: {
            id: true,
            name: true,
            schedule: {
              where: { status: "paid" },
              orderBy: { period: "desc" },
              take: 1,
              select: { closingBalance: true, period: true, dueDate: true },
            },
          },
        },
      },
    });

    const rows = assets.map((a) => {
      const loans = a.debts.map((d) => {
        const lastPaid = d.schedule[0];
        return {
          id: d.id,
          name: d.name,
          outstanding: lastPaid ? lastPaid.closingBalance : 0,
          asOf: lastPaid ? iso(lastPaid.dueDate) : null,
        };
      });
      const outstanding = loans.reduce((s, l) => s + l.outstanding, 0);
      const worth = currentWorth(a, now);
      return {
        id: a.id,
        name: a.name,
        category: a.category,
        acquisitionDate: iso(a.acquisitionDate),
        acquisitionCost: a.acquisitionCost,
        depreciationMethod: a.depreciationMethod,
        usefulLifeMonths: a.usefulLifeMonths,
        salvageValue: a.salvageValue,
        currentValue: a.currentValue,
        valuationDate: iso(a.valuationDate),
        status: a.status,
        disposalDate: iso(a.disposalDate),
        disposalAmount: a.disposalAmount,
        notes: a.notes ?? "",
        // Số tính ra
        accumulatedDepreciation: accumulatedDepreciation(a, now),
        bookValue: bookValue(a, now),
        monthlyDepreciation: monthlyDepreciation(a),
        remainingLifeMonths: remainingLifeMonths(a, now),
        worth,
        // Các khoản vay gắn với tài sản
        loans,
        outstandingDebt: outstanding,
        equity: equity(worth, outstanding),
      };
    });

    const owned = rows.filter((r) => r.status === "owned");

    // Khoản vay CÓ BẢO ĐẢM mà chưa gắn tài sản — để giao diện mời gắn, thay vì
    // âm thầm bỏ sót phần lớn nhất trong bảng cân đối. Vay tín chấp không lọt
    // vào đây: nó không thế chấp gì, nhắc gắn tài sản là lời nhắc không bao giờ
    // tắt được.
    const linkedDebtIds = new Set(rows.flatMap((r) => r.loans.map((l) => l.id)));
    const allDebts = await prisma.debt.findMany({
      where: { userId: user.id, status: "active" },
      select: { id: true, name: true, type: true, remaining: true },
    });
    const unlinkedDebts = allDebts.filter(
      (d) => !linkedDebtIds.has(d.id) && isSecured(d.type)
    );

    return NextResponse.json({
      success: true,
      data: {
        assets: rows,
        categories: ASSET_CATEGORIES,
        unlinkedDebts,
        // Form vẫn cho chọn MỌI khoản vay: bạn có thể muốn gắn một khoản tín
        // chấp vào món đồ mua bằng chính tiền đó. Chỉ phần NHẮC là lọc theo loại.
        allDebts: allDebts.map((d) => ({ id: d.id, name: d.name })),
        totals: {
          count: owned.length,
          acquisitionCost: owned.reduce((s, r) => s + r.acquisitionCost, 0),
          worth: owned.reduce((s, r) => s + r.worth, 0),
          debt: owned.reduce((s, r) => s + r.outstandingDebt, 0),
          equity: owned.reduce((s, r) => s + r.equity, 0),
          monthlyDepreciation: owned.reduce((s, r) => s + r.monthlyDepreciation, 0),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Lọc ra những khoản vay thật sự thuộc về người dùng này. */
async function ownedDebtIds(userId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.debt.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

function parseBody(body: Record<string, unknown>) {
  const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max).trim();
  const int = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  const date = (v: unknown) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? new Date(`${v}T00:00:00Z`)
      : null;

  return {
    name: str(body.name),
    category: str(body.category, 40),
    acquisitionDate: date(body.acquisitionDate),
    acquisitionCost: int(body.acquisitionCost),
    depreciationMethod: body.depreciationMethod === "none" ? "none" : "straight_line",
    usefulLifeMonths: Math.max(0, int(body.usefulLifeMonths)),
    salvageValue: Math.max(0, int(body.salvageValue)),
    currentValue:
      body.currentValue === null || body.currentValue === undefined || body.currentValue === ""
        ? null
        : int(body.currentValue),
    valuationDate: date(body.valuationDate),
    status: ["owned", "sold", "written_off"].includes(String(body.status))
      ? String(body.status)
      : "owned",
    disposalDate: date(body.disposalDate),
    disposalAmount:
      body.disposalAmount === null || body.disposalAmount === undefined || body.disposalAmount === ""
        ? null
        : int(body.disposalAmount),
    debtIds: Array.isArray(body.debtIds) ? body.debtIds.map(String) : [],
    notes: str(body.notes, 500) || null,
  };
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const data = parseBody(await req.json());
    if (!data.name || !data.acquisitionDate || data.acquisitionCost <= 0) {
      return NextResponse.json(
        { success: false, error: "Cần tên, ngày mua và nguyên giá lớn hơn 0" },
        { status: 400 }
      );
    }
    const { debtIds, ...fields } = data;
    const owned = await ownedDebtIds(user.id, debtIds);
    const created = await prisma.asset.create({
      data: { ...fields, acquisitionDate: data.acquisitionDate, userId: user.id },
    });
    if (owned.length > 0) {
      await prisma.debt.updateMany({
        where: { id: { in: owned } },
        data: { assetId: created.id },
      });
    }
    return NextResponse.json({ success: true, data: { id: created.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const id = String(body?.id ?? "");
    const existing = await prisma.asset.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy tài sản này" },
        { status: 404 }
      );
    }
    const data = parseBody(body);
    if (!data.name || !data.acquisitionDate || data.acquisitionCost <= 0) {
      return NextResponse.json(
        { success: false, error: "Cần tên, ngày mua và nguyên giá lớn hơn 0" },
        { status: 400 }
      );
    }
    const { debtIds, ...fields } = data;
    const owned = await ownedDebtIds(user.id, debtIds);
    await prisma.$transaction([
      prisma.asset.update({
        where: { id },
        data: { ...fields, acquisitionDate: data.acquisitionDate },
      }),
      // Bỏ gắn những khoản vay không còn được chọn, rồi gắn lại đúng danh sách.
      prisma.debt.updateMany({
        where: { userId: user.id, assetId: id, id: { notIn: owned.length ? owned : ["-"] } },
        data: { assetId: null },
      }),
      prisma.debt.updateMany({
        where: { userId: user.id, id: { in: owned } },
        data: { assetId: id },
      }),
    ]);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const existing = await prisma.asset.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy tài sản này" },
        { status: 404 }
      );
    }
    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
