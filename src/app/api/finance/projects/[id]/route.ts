export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { projectAnalysis } from "@/lib/projects";

// Next.js 16: params của route động là Promise, phải await.
type Ctx = { params: Promise<{ id: string }> };

/**
 * Phân tích một dự án: tổng vốn/doanh thu, đường luỹ kế, hoà vốn, vốn đi đâu,
 * và toàn bộ giao dịch của nó (đủ trường để mở lại trong `TransactionModal`).
 *
 * `today` do client gửi: máy chủ chạy UTC, nên từ 0h tới 7h sáng giờ Việt Nam
 * "tháng này" của máy chủ có thể vẫn là tháng trước.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const todayParam = new URL(req.url).searchParams.get("today") ?? "";
    const today = /^\d{4}-\d{2}-\d{2}$/.test(todayParam)
      ? todayParam
      : new Date().toISOString().slice(0, 10);

    const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id, projectId: id },
      include: { items: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    const analysis = projectAnalysis(transactions, {
      today,
      startDate: project.startDate,
      budget: project.budget,
    });

    return NextResponse.json({
      success: true,
      data: {
        project: {
          ...project,
          startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : null,
        },
        ...analysis,
        transactions: transactions.map((t) => ({
          ...t,
          date: t.date.toISOString().slice(0, 10),
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
