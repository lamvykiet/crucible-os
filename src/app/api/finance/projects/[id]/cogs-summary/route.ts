export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { budgetStatus, summarizeLedger } from "@/lib/projectCost";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Tổng hợp giá thành một dự án — đúng hình dạng "API 2" của bản thiết kế PCT.
 *
 * Không có bảng `cogs_summary` lưu sẵn như bản thiết kế: con số tính thẳng từ
 * sổ cái mỗi lần hỏi, nên không bao giờ lệch với sổ.
 *
 * `cost_breakdown` là TỔNG chi phí đã phát sinh từng nhóm (WIP + đã kết chuyển);
 * `wip` / `cogs` tách riêng phần còn dở dang và phần đã thành giá vốn.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    }
    const ledger = await prisma.projectLedgerEntry.findMany({ where: { projectId: id, userId: user.id } });
    const s = summarizeLedger(ledger);
    const total = (code: string) => (s.wip[code] ?? 0) + (s.cogs[code] ?? 0);
    const b = budgetStatus(project.budget, s.totalCost);

    return NextResponse.json({
      success: true,
      data: {
        project_id: project.id,
        project_name: project.name,
        currency: "VND",
        cost_breakdown: {
          raw_materials: total("RAW_MATERIAL"),
          machinery: total("MACHINERY"),
          testing_and_validation: total("TESTING"),
          labor: total("LABOR"),
          overheads: total("OVERHEAD"),
        },
        total_cost: s.totalCost,
        wip: s.totalWip,
        total_cogs: s.totalCogs,
        revenue: s.revenue,
        gross_profit: s.grossProfit,
        budget: b.budget,
        variance: b.variance,
        status: b.status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
