export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { projectAnalysis } from "@/lib/projects";
import { loadProjectRows } from "@/lib/projectData";
import { budgetStatus, signedAmount, summarizeLedger } from "@/lib/projectCost";

// Next.js 16: params của route động là Promise, phải await.
type Ctx = { params: Promise<{ id: string }> };

/** Bao nhiêu dòng sổ cái gửi về cho màn hình (mới nhất trước). */
const LEDGER_ROWS = 60;

/**
 * Phân tích một dự án: dòng tiền (vốn/doanh thu, hoà vốn), giá vốn (WIP/COGS
 * theo năm nhóm chi phí, so ngân sách), sổ cái, và các giao dịch có phân bổ cho
 * dự án (đủ trường để mở lại trong `TransactionModal`).
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

    const [rows, ledger] = await Promise.all([
      loadProjectRows(user.id, id),
      prisma.projectLedgerEntry.findMany({
        where: { projectId: id, userId: user.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ]);

    const analysis = projectAnalysis(
      rows.map((r) => r.row),
      { today, startDate: project.startDate, budget: project.budget }
    );
    const cogs = summarizeLedger(ledger);

    // Số luỹ kế tổng chi phí (WIP + COGS) sau từng dòng — tính lúc đọc, không
    // lưu, để sổ vẫn đúng chỉ-ghi-thêm mà không phải khoá bảng khi chèn.
    let running = 0;
    const ledgerView = ledger.map((e) => {
      if (e.bucket !== "REVENUE") running += signedAmount(e);
      return {
        id: e.id,
        transactionId: e.transactionId,
        costCategory: e.costCategory,
        bucket: e.bucket,
        entryType: e.entryType,
        amount: e.amount,
        kind: e.kind,
        postingDate: e.postingDate.toISOString().slice(0, 10),
        createdAt: e.createdAt.toISOString(),
        note: e.note,
        runningTotalCost: running,
      };
    });

    // Một giao dịch có thể có hai phân bổ cho cùng dự án (hai nhóm chi phí) —
    // gộp lại thành một dòng, kèm danh sách phần để form sửa nạp đúng.
    const byTx = new Map<string, (typeof rows)[number][]>();
    for (const r of rows) byTx.set(r.transaction.id, [...(byTx.get(r.transaction.id) ?? []), r]);
    const allSplits = await prisma.projectAllocation.findMany({
      where: { transactionId: { in: [...byTx.keys()] } },
      select: { transactionId: true, projectId: true, costCategory: true, percentage: true, notes: true },
      orderBy: { createdAt: "asc" },
    });

    const transactions = [...byTx.values()].map((parts) => {
      const t = parts[0].transaction;
      return {
        ...t,
        date: t.date.toISOString().slice(0, 10),
        projectAmount: parts.reduce((s, p) => s + p.allocation.amount, 0),
        projectPercentage: parts.reduce((s, p) => s + p.allocation.percentage, 0),
        costCategories: parts.map((p) => p.allocation.costCategory),
        // Phân bổ đầy đủ của giao dịch (mọi dự án) — để mở form sửa không làm
        // rơi phần của dự án khác.
        projectSplits: allSplits
          .filter((s) => s.transactionId === t.id)
          .map(({ projectId, costCategory, percentage, notes }) => ({ projectId, costCategory, percentage, notes })),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        project: {
          ...project,
          startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : null,
        },
        ...analysis,
        cogs: {
          ...cogs,
          ...budgetStatus(project.budget, cogs.totalCost),
          // Sổ cái phải khớp phân bổ: tổng chi phí trên sổ = tổng phân bổ chi.
          // Lệch là có đường ghi giao dịch nào đó quên gọi syncProjectLedger.
          reconciled: cogs.totalCost === analysis.totals.cost && cogs.revenue === analysis.totals.revenue,
        },
        ledger: ledgerView.slice(-LEDGER_ROWS).reverse(),
        ledgerCount: ledgerView.length,
        transactions,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
