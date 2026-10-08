export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isCostCategory, REVENUE } from "@/lib/projectCost";
import { syncProjectLedger } from "@/lib/projectLedger";

// Gắn giao dịch ĐÃ GHI từ trước vào dự án.
//
// Dự án thường được khai báo sau khi đã tiêu cho nó một thời gian — máy in mua
// tháng trước, cuộn nhựa đầu tiên mua tuần trước. Không có đường này thì mấy
// khoản đó phải xoá đi ghi lại mới vào được dự án.

type Ctx = { params: Promise<{ id: string }> };

const MAX_RESULTS = 80;

/** Giao dịch chưa phân bổ cho dự án nào, lọc theo từ khoá (nơi chi, ghi chú, tên món). */
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
        allocations: { none: {} },
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

/**
 * `{ transactionIds, attach, costCategory }`.
 *
 * Gắn: mỗi giao dịch nhận một phân bổ 100% cho dự án này — chỉ với giao dịch
 * CHƯA phân bổ cho dự án nào (không lặng lẽ giật một khoản đang thuộc dự án
 * khác). Khoản thu tự thành doanh thu, bỏ qua `costCategory`.
 * Gỡ (attach=false): xoá phân bổ của dự án này, giao dịch vẫn còn trong sổ.
 * Cả hai đều ghi sổ cái (ghi mới / đảo).
 */
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

    const category = isCostCategory(String(body.costCategory)) ? String(body.costCategory) : "RAW_MATERIAL";

    const count = await prisma.$transaction(async (tx) => {
      let changed: string[] = [];
      if (attach) {
        if ((await tx.project.count({ where: { id, userId: user.id, status: "active" } })) === 0) {
          throw new Error("Dự án không còn đang chạy — mở lại dự án rồi mới gắn chi phí mới được");
        }
        const targets = await tx.transaction.findMany({
          where: {
            id: { in: ids },
            userId: user.id,
            allocations: { none: {} },
            type: { in: ["Expense", "Refund", "Income"] },
          },
          select: { id: true, type: true, totalAmount: true },
        });
        if (targets.length > 0) {
          await tx.projectAllocation.createMany({
            data: targets.map((t) => ({
              transactionId: t.id,
              projectId: id,
              costCategory: t.type === "Income" ? REVENUE : category,
              percentage: 100,
              amount: Math.abs(t.totalAmount),
              userId: user.id,
            })),
          });
        }
        changed = targets.map((t) => t.id);
      } else {
        const rows = await tx.projectAllocation.findMany({
          where: { transactionId: { in: ids }, projectId: id, userId: user.id },
          select: { transactionId: true },
        });
        await tx.projectAllocation.deleteMany({
          where: { transactionId: { in: ids }, projectId: id, userId: user.id },
        });
        changed = rows.map((r) => r.transactionId);
      }
      await syncProjectLedger(tx, user.id, changed);
      return new Set(changed).size;
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
