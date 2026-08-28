export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { recalcFrom, type ScheduleRow } from "@/lib/debtSchedule";

// Lịch trả nợ từng kỳ: đọc, và sửa một kỳ rồi tính lại các kỳ sau.
// Quy tắc tính lại nằm trong @/lib/debtSchedule — tách ra để kiểm chứng được
// bằng dữ liệu thật mà không phải đi qua tầng xác thực.

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const debtId = new URL(req.url).searchParams.get("debtId");
    if (!debtId) {
      return NextResponse.json(
        { success: false, error: "Thiếu debtId" },
        { status: 400 }
      );
    }

    const debt = await prisma.debt.findFirst({
      where: { id: debtId, userId: user.id },
      select: { id: true, name: true, principal: true, remaining: true },
    });
    if (!debt) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy khoản nợ" },
        { status: 404 }
      );
    }

    const rows = await prisma.debtSchedule.findMany({
      where: { debtId },
      orderBy: { period: "asc" },
    });

    const paid = rows.filter((r) => r.status === "paid");
    const next = rows.find((r) => r.status === "projected");

    return NextResponse.json({
      success: true,
      data: {
        debt,
        periods: rows.map((r) => ({
          id: r.id,
          period: r.period,
          dueDate: r.dueDate.toISOString().slice(0, 10),
          interestDays: r.interestDays,
          openingBalance: r.openingBalance,
          principal: r.principal,
          interest: r.interest,
          payment: r.payment,
          closingBalance: r.closingBalance,
          interestRate: r.interestRate,
          status: r.status,
          note: r.note || "",
        })),
        summary: {
          total: rows.length,
          paidCount: paid.length,
          projectedCount: rows.length - paid.length,
          interestPaid: paid.reduce((s, r) => s + r.interest, 0),
          interestRemaining: rows
            .filter((r) => r.status === "projected")
            .reduce((s, r) => s + r.interest, 0),
          nextPeriod: next
            ? {
                period: next.period,
                dueDate: next.dueDate.toISOString().slice(0, 10),
                payment: next.payment,
                interestRate: next.interestRate,
              }
            : null,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { id, ...patch } = body ?? {};
    if (typeof id !== "string") {
      return NextResponse.json(
        { success: false, error: "Thiếu id của kỳ cần sửa" },
        { status: 400 }
      );
    }

    const target = await prisma.debtSchedule.findUnique({
      where: { id },
      include: { debt: { select: { id: true, userId: true } } },
    });
    if (!target || target.debt.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy kỳ này" },
        { status: 404 }
      );
    }

    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;

    const data: Record<string, unknown> = {};
    if ("dueDate" in patch && /^\d{4}-\d{2}-\d{2}$/.test(String(patch.dueDate))) {
      data.dueDate = new Date(`${patch.dueDate}T00:00:00Z`);
    }
    if ("interestDays" in patch) data.interestDays = num(patch.interestDays, target.interestDays);
    if ("principal" in patch) data.principal = num(patch.principal, target.principal);
    if ("interest" in patch) data.interest = num(patch.interest, target.interest);
    if ("interestRate" in patch && typeof patch.interestRate === "number") {
      data.interestRate = patch.interestRate;
    }
    if ("status" in patch && (patch.status === "paid" || patch.status === "projected")) {
      data.status = patch.status;
    }
    if ("note" in patch) data.note = String(patch.note ?? "").slice(0, 500) || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: "Không có gì để sửa" },
        { status: 400 }
      );
    }

    const debtId = target.debt.id;

    const result = await prisma.$transaction(async (tx) => {
      await tx.debtSchedule.update({ where: { id }, data });

      const rows = (await tx.debtSchedule.findMany({
        where: { debtId },
        orderBy: { period: "asc" },
        select: {
          id: true, period: true, openingBalance: true, principal: true,
          interest: true, payment: true, closingBalance: true,
          interestRate: true, interestDays: true, status: true,
        },
      })) as ScheduleRow[];

      const idx = rows.findIndex((r) => r.id === id);
      // Bắt đầu từ chính kỳ vừa sửa: gốc/lãi/lãi suất của nó có thể đã đổi.
      const changed = recalcFrom(rows, Math.max(0, idx));

      // Sửa một kỳ sớm kéo theo gần 200 dòng phải cập nhật. Ghi từng dòng một
      // là gần 200 lượt đi-về tới Supabase, vượt hạn 5 giây của transaction và
      // chết giữa chừng — đã tái hiện được. Gộp thành MỘT câu UPDATE ... FROM
      // (VALUES ...), vẫn tham số hoá nên không có chuyện chèn SQL.
      if (changed.length > 0) {
        const values = Prisma.join(
          changed.map(
            (r) => Prisma.sql`(${r.id}::text, ${r.openingBalance}::int, ${r.interest}::int, ${r.payment}::int, ${r.closingBalance}::int)`
          )
        );
        await tx.$executeRaw`
          UPDATE "DebtSchedule" AS d
          SET "openingBalance" = v.ob,
              "interest"       = v.i,
              "payment"        = v.p,
              "closingBalance" = v.cb,
              "updatedAt"      = NOW()
          FROM (VALUES ${values}) AS v(id, ob, i, p, cb)
          WHERE d.id = v.id
        `;
      }

      // Dòng tóm tắt phải bám theo lịch, không nhập tay: dư nợ = số cuối của kỳ
      // đã chốt gần nhất, trả hàng tháng = kỳ chưa trả kế tiếp.
      const paid = rows.filter((r) => r.status === "paid");
      const next = rows.find((r) => r.status === "projected");
      await tx.debt.update({
        where: { id: debtId },
        data: {
          remaining: paid.length ? paid[paid.length - 1].closingBalance : rows[0].openingBalance,
          monthlyPayment: next ? next.payment : 0,
          interestRate: next ? next.interestRate : target.interestRate,
          status: next ? "active" : "settled",
        },
      });

      return { recalculated: changed.length };
    }, { timeout: 20000 });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
