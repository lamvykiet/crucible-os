import { prisma } from "@/lib/prisma";
import type { ProjectTx } from "@/lib/projects";

/**
 * Phân bổ của một (hoặc mọi) dự án, đổi sang `ProjectTx` cho `projectAnalysis`.
 *
 * `totalAmount` là số tiền ĐÃ PHÂN BỔ chứ không phải tổng hoá đơn, và chi tiết
 * món hàng cũng co theo tỷ lệ — hoá đơn chia 60/40 thì "mua gì nhiều nhất" của
 * dự án chỉ thấy 60% mỗi món.
 */
export async function loadProjectRows(userId: string, projectId?: string) {
  const allocations = await prisma.projectAllocation.findMany({
    where: { userId, ...(projectId && { projectId }) },
    include: { transaction: { include: { items: true } } },
    orderBy: [{ transaction: { date: "desc" } }, { createdAt: "desc" }],
  });

  return allocations.map((a) => {
    const t = a.transaction;
    const ratio = a.percentage / 100;
    const row: ProjectTx = {
      id: t.id,
      date: t.date,
      type: t.type,
      supplier: t.supplier,
      categoryGroup: t.categoryGroup,
      subGroup: t.subGroup,
      totalAmount: a.amount,
      costCategory: a.costCategory,
      items: t.items.map((it) => ({
        productName: it.productName,
        quantity: Math.round(it.quantity * ratio * 100) / 100,
        totalPrice: Math.round(it.totalPrice * ratio),
      })),
    };
    return { allocation: a, transaction: t, row };
  });
}
