export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Gắn giao dịch ĐÃ GHI từ trước vào dự án.
//
// Dự án thường được khai báo sau khi đã tiêu cho nó một thời gian — máy in mua
// tháng trước, cuộn nhựa đầu tiên mua tuần trước. Không có đường này thì mấy
// khoản đó phải xoá đi ghi lại mới vào được dự án.

type Ctx = { params: Promise<{ id: string }> };

const MAX_RESULTS = 80;

/** Giao dịch chưa thuộc dự án nào, lọc theo từ khoá (nơi chi, ghi chú, tên món). */
export async function GET(req: Request, { params }: Ctx) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const project = await prisma.project.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!project) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const type = url.searchParams.get("type");

    const contains = { contains: q, mode: "insensitive" as const };
    const rows = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        projectId: null,
        type: type === "Income" ? "Income" : type === "Expense" ? { in: ["Expense", "Refund"] } : { in: ["Expense", "Refund", "Income"] },
        ...(q && {
          OR: [
            { supplier: contains },
            { notes: contains },
            { categoryGroup: contains },
            { subGroup: contains },
            { items: { some: { productName: contains } } },
          ],
        }),
      },
      select: {
        id: true,
        date: true,
        type: true,
        supplier: true,
        categoryGroup: true,
        subGroup: true,
        totalAmount: true,
        notes: true,
        items: { select: { productName: true }, take: 3 },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: MAX_RESULTS,
    });

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({ ...r, date: r.date.toISOString().slice(0, 10) })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** `{ transactionIds, attach }` — attach=false là gỡ khỏi dự án (không xoá giao dịch). */
export async function POST(req: Request, { params }: Ctx) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const body = await req.json();
    const ids = Array.isArray(body.transactionIds)
      ? body.transactionIds.map(String).slice(0, 500)
      : [];
    const attach = body.attach !== false;
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "Chưa chọn giao dịch nào" }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!project) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const result = await prisma.transaction.updateMany({
      // Gắn: chỉ lấy giao dịch chưa thuộc dự án nào — không lặng lẽ giật một
      // khoản đang nằm ở dự án khác. Gỡ: chỉ gỡ khoản đang thuộc đúng dự án này.
      where: { id: { in: ids }, userId: user.id, projectId: attach ? null : id },
      data: { projectId: attach ? id : null },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
