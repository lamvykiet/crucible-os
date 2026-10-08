import type { Prisma } from "@prisma/client";
import {
  cleanSplits,
  desiredBalances,
  isCostCategory,
  projectSide,
  REVENUE,
  signedAmount,
  splitAmounts,
  type Bucket,
} from "@/lib/projectCost";

// Phân bổ dự án và sổ cái chỉ-ghi-thêm — phần đụng DB.
//
// Mọi hàm ở đây nhận `tx` của một `prisma.$transaction` đang mở: giao dịch,
// phân bổ của nó và bút toán sổ cái phải cùng thành công hoặc cùng huỷ. Đây là
// lý do không cần hàng đợi sự kiện / outbox như bản thiết kế gốc: cả hai "phân
// hệ" nằm chung một database, nên nhất quán ngay lập tức chứ không phải "sau
// vài giây".
//
// QUY TẮC: chỗ nào tạo, sửa hay xoá `Transaction` thì phải gọi
// `syncProjectLedger` cho id đó trong cùng `$transaction`. Quên là sổ cái lệch
// với phân bổ mà không có gì báo — chính cái lỗi mà sổ cái sinh ra để bắt.

type Tx = Prisma.TransactionClient;

/** Lỗi do người dùng nhập (trả 400), khác lỗi hệ thống (500). */
export class ProjectSplitError extends Error {}

/**
 * Ghi lại phân bổ của một giao dịch theo danh sách từ form, thay hẳn phân bổ cũ.
 *
 * Dự án đang tạm dừng hay đã đóng thì không nhận phân bổ MỚI — nhưng một phân
 * bổ đã có từ trước vẫn giữ được khi sửa giao dịch, nếu không thì đóng dự án
 * xong là không sửa được giao dịch cũ nào của nó nữa.
 */
export async function saveAllocations(
  tx: Tx,
  {
    userId,
    transactionId,
    type,
    totalAmount,
    rawSplits,
  }: { userId: string; transactionId: string; type: string; totalAmount: number; rawSplits: unknown }
) {
  const { splits, error } = cleanSplits(rawSplits, type);
  if (error) throw new ProjectSplitError(error);

  const existing = await tx.projectAllocation.findMany({
    where: { transactionId },
    select: { projectId: true },
  });
  const alreadyHere = new Set(existing.map((a) => a.projectId));

  if (splits.length > 0) {
    const projects = await tx.project.findMany({
      where: { userId, id: { in: splits.map((s) => s.projectId) } },
      select: { id: true, name: true, status: true },
    });
    for (const s of splits) {
      const p = projects.find((x) => x.id === s.projectId);
      if (!p) throw new ProjectSplitError("Không tìm thấy dự án đã chọn");
      if (p.status !== "active" && !alreadyHere.has(p.id)) {
        throw new ProjectSplitError(
          `Dự án "${p.name}" đang ${p.status === "closed" ? "đã đóng" : "tạm dừng"} — mở lại dự án rồi mới ghi chi phí mới vào được`
        );
      }
    }
  }

  await tx.projectAllocation.deleteMany({ where: { transactionId } });
  if (splits.length === 0) return;

  const amounts = splitAmounts(totalAmount, splits);
  await tx.projectAllocation.createMany({
    data: splits.map((s, i) => ({
      transactionId,
      projectId: s.projectId,
      costCategory: s.costCategory,
      percentage: s.percentage,
      amount: amounts[i],
      notes: s.notes ?? null,
      userId,
    })),
  });
}

/**
 * Giao dịch đổi số tiền hay đổi loại mà form không gửi lại phân bổ: giữ tỷ lệ,
 * tính lại số tiền. Đổi sang loại không thuộc dự án (chuyển khoản…) thì gỡ
 * hẳn phân bổ; đổi chi ↔ thu thì đổi nhóm cho khớp phía mới.
 */
export async function refreshAllocations(
  tx: Tx,
  { transactionId, type, totalAmount }: { transactionId: string; type: string; totalAmount: number }
) {
  const side = projectSide(type);
  const rows = await tx.projectAllocation.findMany({
    where: { transactionId },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) return;
  if (!side) {
    await tx.projectAllocation.deleteMany({ where: { transactionId } });
    return;
  }
  const amounts = splitAmounts(totalAmount, rows);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const costCategory =
      side === "revenue" ? REVENUE : isCostCategory(r.costCategory) ? r.costCategory : "RAW_MATERIAL";
    if (r.amount !== amounts[i] || r.costCategory !== costCategory) {
      await tx.projectAllocation.update({
        where: { id: r.id },
        data: { amount: amounts[i], costCategory },
      });
    }
  }
}

const natural = (bucket: string) => (bucket === "REVENUE" ? "CREDIT" : "DEBIT");
const opposite = (side: string) => (side === "DEBIT" ? "CREDIT" : "DEBIT");

function entry(value: number, bucket: string) {
  return {
    entryType: value > 0 ? natural(bucket) : opposite(natural(bucket)),
    amount: Math.abs(value),
  };
}

/**
 * Đưa sổ cái về khớp với phân bổ hiện tại của các giao dịch.
 *
 * Với mỗi (dự án × nhóm chi phí × WIP/doanh thu), so số dư sổ cái đang ghi cho
 * giao dịch với số dư lẽ ra phải có. Lệch thì ĐẢO nguyên dòng cũ rồi GHI LẠI số
 * mới — không bao giờ sửa dòng cũ. Giao dịch đã bị xoá thì "lẽ ra phải có" là
 * 0, nên mọi dòng của nó được đảo về 0.
 *
 * Chạy lại bao nhiêu lần cũng được: sổ đã khớp thì không ghi thêm gì.
 */
export async function syncProjectLedger(
  tx: Tx,
  userId: string,
  transactionIds: string[],
  now = new Date()
) {
  for (const transactionId of [...new Set(transactionIds)]) {
    const t = await tx.transaction.findFirst({
      where: { id: transactionId, userId },
      select: {
        date: true,
        type: true,
        supplier: true,
        allocations: { select: { projectId: true, costCategory: true, amount: true } },
      },
    });
    const desired = t ? desiredBalances(t.type, t.allocations) : new Map<string, number>();

    const posted = await tx.projectLedgerEntry.findMany({
      where: { transactionId, userId, kind: { in: ["POSTING", "REVERSAL"] } },
      select: { projectId: true, costCategory: true, bucket: true, entryType: true, amount: true },
    });
    const current = new Map<string, number>();
    for (const r of posted) {
      const key = `${r.projectId}|${r.costCategory}|${r.bucket}`;
      current.set(key, (current.get(key) ?? 0) + signedAmount(r));
    }

    const rows: Prisma.ProjectLedgerEntryCreateManyInput[] = [];
    for (const key of new Set([...desired.keys(), ...current.keys()])) {
      const want = desired.get(key) ?? 0;
      const have = current.get(key) ?? 0;
      if (want === have) continue;
      const [projectId, costCategory, bucket] = key.split("|") as [string, string, Bucket];
      if (have !== 0) {
        rows.push({
          projectId,
          transactionId,
          costCategory,
          bucket,
          ...entry(-have, bucket),
          kind: "REVERSAL",
          postingDate: now,
          note: t ? "Đảo bút toán cũ — giao dịch được sửa" : "Đảo bút toán — giao dịch đã bị xoá",
          userId,
        });
      }
      if (want !== 0 && t) {
        rows.push({
          projectId,
          transactionId,
          costCategory,
          bucket,
          ...entry(want, bucket),
          kind: "POSTING",
          postingDate: t.date,
          note: t.supplier,
          userId,
        });
      }
    }
    if (rows.length > 0) await tx.projectLedgerEntry.createMany({ data: rows });
  }
}

/**
 * Lối gọi gọn cho route ghi giao dịch: `rawSplits === undefined` nghĩa là form
 * không đụng tới phân bổ (giữ tỷ lệ, tính lại tiền); có gửi thì thay hẳn.
 */
export async function applyProjectSplits(
  tx: Tx,
  args: { userId: string; transactionId: string; type: string; totalAmount: number; rawSplits: unknown }
) {
  if (args.rawSplits === undefined) await refreshAllocations(tx, args);
  else await saveAllocations(tx, args);
  await syncProjectLedger(tx, args.userId, [args.transactionId]);
}
