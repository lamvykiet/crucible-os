export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { accountBalances, type AccountRow, type TxRow } from "@/lib/accounts";

// Tài khoản thanh toán: tài khoản ngân hàng, thẻ tín dụng, ví, tiền mặt.
//
// Số dư KHÔNG lưu sẵn trong bảng mà tính lại mỗi lần hỏi, từ số dư đầu kỳ cộng
// dồn các giao dịch gắn với tài khoản. Lưu sẵn thì mỗi lần sửa hay xoá một giao
// dịch cũ là một lần số dư lệch âm thầm, không có cách nào biết nó đã lệch.

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });

    // Chỉ lấy giao dịch CÓ gắn tài khoản. Hơn 260 giao dịch cũ chưa gắn thì
    // không được tính vào số dư — tính vào là ra một con số sai mà trông như
    // thật.
    const tx = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        OR: [{ accountId: { not: null } }, { toAccountId: { not: null } }],
      },
      select: {
        date: true,
        type: true,
        totalAmount: true,
        accountId: true,
        toAccountId: true,
      },
      orderBy: { date: "asc" },
    });

    const data = accountBalances(accounts as AccountRow[], tx as TxRow[]);

    // Số giao dịch chưa gắn tài khoản — nói thẳng ra, vì nó là lý do khiến số
    // dư tính được có thể lệch với số dư thật ở ngân hàng.
    const unlinked = await prisma.transaction.count({
      where: { userId: user.id, accountId: null, toAccountId: null },
    });

    return NextResponse.json({ success: true, data: { ...data, unlinked } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Nhận và làm sạch dữ liệu từ form. */
function parseBody(body: Record<string, unknown>) {
  const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max).trim();
  const intOrNull = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : Math.round(Number(v) || 0);
  const dayOrNull = (v: unknown) => {
    const n = intOrNull(v);
    return n !== null && n >= 1 && n <= 31 ? n : null;
  };

  const kind = str(body.kind) || "bank";
  return {
    name: str(body.name),
    kind,
    bank: str(body.bank) || null,
    // Chỉ giữ chữ số, tối đa 4 — không bao giờ lưu số thẻ đầy đủ.
    last4: str(body.last4, 4).replace(/\D/g, "").slice(-4) || null,
    openingBalance: Math.round(Number(body.openingBalance) || 0),
    openingDate:
      typeof body.openingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.openingDate)
        ? new Date(`${body.openingDate}T00:00:00Z`)
        : null,
    // Ba trường dưới chỉ có nghĩa với thẻ tín dụng; loại khác thì xoá hẳn để
    // không còn giá trị cũ nằm lại sau khi đổi loại tài khoản.
    creditLimit: kind === "credit_card" ? intOrNull(body.creditLimit) : null,
    statementDay: kind === "credit_card" ? dayOrNull(body.statementDay) : null,
    dueDay: kind === "credit_card" ? dayOrNull(body.dueDay) : null,
    status: str(body.status) === "closed" ? "closed" : "active",
    notes: str(body.notes, 500) || null,
  };
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const parsed = parseBody(body);
    if (!parsed.name) {
      return NextResponse.json(
        { success: false, error: "Thiếu tên tài khoản" },
        { status: 400 }
      );
    }
    const created = await prisma.account.create({
      data: { ...parsed, userId: user.id },
    });
    return NextResponse.json({ success: true, data: created });
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
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
    }
    // Lọc theo userId trong chính câu update: không cho sửa tài khoản của người khác.
    const result = await prisma.account.updateMany({
      where: { id, userId: user.id },
      data: parseBody(body),
    });
    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy tài khoản" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Đóng tài khoản, KHÔNG xoá.
 *
 * Xoá thì mọi giao dịch đã gắn vào nó bị gỡ liên kết (onDelete: SetNull) và số
 * dư lịch sử mất theo, không khôi phục được. Đóng thì tài khoản rời khỏi phần
 * tổng số dư nhưng lịch sử vẫn nguyên.
 */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
    }
    const result = await prisma.account.updateMany({
      where: { id, userId: user.id },
      data: { status: "closed" },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy tài khoản" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
