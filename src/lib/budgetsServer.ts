import type { Prisma } from "@prisma/client";
import { budgetKindOfCategory } from "@/lib/budgets";

// Phần ngân sách cần tới Prisma. Logic tính toán nằm ở `budgets.ts`.

/**
 * Dời ngân sách của nhóm `from` sang nhóm `into` khi đổi tên hoặc gộp danh mục.
 *
 * Phải lọc theo `kind`: tên nhóm chi và nhóm thu có thể trùng nhau ("Other" chi
 * và "Other" thu), dời không lọc là kéo luôn mục tiêu thu của nhóm kia theo.
 *
 * Bảng `Budget` có ràng buộc duy nhất (người dùng, loại kỳ, kỳ, kind, nhóm), nên
 * không dùng `updateMany` được: nếu tháng đó nhóm đích đã có dòng thì cộng dồn
 * vào dòng đó rồi xoá dòng nguồn. Chạy trong `$transaction` của nơi gọi.
 */
export async function moveBudgets(
  tx: Prisma.TransactionClient,
  userId: string,
  categoryKind: string,
  from: string,
  into: string
): Promise<number> {
  const kind = budgetKindOfCategory(categoryKind);
  if (!kind || from === into) return 0;

  const rows = await tx.budget.findMany({ where: { userId, kind, categoryGroup: from } });
  if (rows.length === 0) return 0;

  const targets = await tx.budget.findMany({ where: { userId, kind, categoryGroup: into } });
  const targetOf = new Map(targets.map((b) => [`${b.periodType}|${b.period}`, b]));

  for (const row of rows) {
    const hit = targetOf.get(`${row.periodType}|${row.period}`);
    if (hit) {
      await tx.budget.update({ where: { id: hit.id }, data: { amount: hit.amount + row.amount } });
      await tx.budget.delete({ where: { id: row.id } });
    } else {
      await tx.budget.update({ where: { id: row.id }, data: { categoryGroup: into } });
    }
  }
  return rows.length;
}
