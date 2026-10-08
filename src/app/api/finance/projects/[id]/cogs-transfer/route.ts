export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { planCogsTransfer, summarizeLedger } from "@/lib/projectCost";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Kết chuyển chi phí dở dang (WIP) sang giá vốn (COGS).
 *
 * Body: `{ amount }` (VND) hoặc `{ percentage }` (% của WIP hiện có), cùng
 * `date` và `note`. Ví dụ: giao xong lô 20 sản phẩm trên 100 dự kiến → kết
 * chuyển 20% WIP. Khoản kết chuyển chia cho từng nhóm chi phí theo tỷ trọng
 * WIP hiện có, mỗi nhóm một cặp bút toán Có WIP / Nợ COGS. Tổng chi phí không
 * đổi — chỉ dời từ "đang làm" sang "đã bán".
 *
 * Kết chuyển nhầm thì kết chuyển ngược bằng số âm (`amount` < 0): sổ chỉ ghi
 * thêm, không xoá dòng cũ.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await params;
    const body = await req.json();
    const project = await prisma.project.findFirst({ where: { id, userId: user.id } });
    if (!project) {
      return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    }

    const date =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? new Date(`${body.date}T00:00:00Z`)
        : new Date();
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";

    const created = await prisma.$transaction(async (tx) => {
      const ledger = await tx.projectLedgerEntry.findMany({ where: { projectId: id, userId: user.id } });
      const s = summarizeLedger(ledger);

      let amount = Math.round(Number(body.amount) || 0);
      if (!amount && body.percentage !== undefined) {
        const pct = Number(body.percentage);
        if (!(pct > 0) || pct > 100) throw new Error("Tỷ lệ kết chuyển phải từ trên 0% tới 100%");
        amount = Math.round((s.totalWip * pct) / 100);
      }
      if (amount === 0) throw new Error("Chưa nhập số tiền hay tỷ lệ kết chuyển");

      // Số âm = kết chuyển ngược (COGS → WIP), chia theo tỷ trọng COGS hiện có.
      const reverse = amount < 0;
      const parts = planCogsTransfer(reverse ? s.cogs : s.wip, Math.abs(amount));
      if (parts.length === 0) {
        throw new Error(reverse ? "Chưa có giá vốn nào để kết chuyển ngược" : "Không còn chi phí dở dang (WIP) để kết chuyển");
      }

      const label = reverse ? "Kết chuyển ngược giá vốn về WIP" : "Kết chuyển WIP sang giá vốn";
      const rows = parts.flatMap((p) => [
        {
          projectId: id,
          transactionId: null,
          costCategory: p.code,
          bucket: reverse ? "COGS" : "WIP",
          entryType: "CREDIT",
          amount: p.amount,
          kind: "COGS_TRANSFER",
          postingDate: date,
          note: note ? `${label} — ${note}` : label,
          userId: user.id,
        },
        {
          projectId: id,
          transactionId: null,
          costCategory: p.code,
          bucket: reverse ? "WIP" : "COGS",
          entryType: "DEBIT",
          amount: p.amount,
          kind: "COGS_TRANSFER",
          postingDate: date,
          note: note ? `${label} — ${note}` : label,
          userId: user.id,
        },
      ]);
      await tx.projectLedgerEntry.createMany({ data: rows });
      return parts.reduce((sum, p) => sum + p.amount, 0);
    });

    return NextResponse.json({ success: true, transferred: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
