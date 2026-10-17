import type { DraftReceipt, Transaction, TransactionLine } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyProjectSplits } from "@/lib/projectLedger";
import {
  getDriveClient,
  moveFilesTo,
  getOrCreateFolderIds,
  INVOICE_ROOT_FOLDER_ID,
} from "@/lib/drive";
import { normalizeSupplier, utcDayRange, toVnd } from "@/lib/invoice";
import { LEARNED_RULE_PRIORITY } from "@/lib/classify";
import { logOcr } from "@/lib/ocrLog";

/**
 * Bước 3 của luồng hoá đơn: duyệt bản nháp → ghi chính thức `Transaction` +
 * `TransactionLine`.
 *
 * Tách khỏi route `process-ocr` để hộp thoại duyệt và bot Telegram đi qua ĐÚNG
 * một đường ghi sổ. Viết đường thứ hai là sớm muộn một bên quên kiểm trùng,
 * quên `applyProjectSplits` hay quên dời ảnh sang Approved_Invoices.
 *
 * Không tự xoá gì cả: phát hiện trùng thì chỉ *báo* rồi dừng; người dùng chọn
 * `force` để vẫn ghi, hoặc huỷ bản nháp.
 */

export interface ApproveInput {
  userId: string;
  draft: DraftReceipt;
  // Dữ liệu form: hộp thoại gửi chuỗi, bot gửi số — cả hai đều đi qua toVnd().
  formData: Record<string, unknown> & { date: string; type: string };
  items: Array<Record<string, unknown>>;
  force?: boolean;
  saveRule?: boolean;
  /** `ocr` cho hoá đơn có ảnh; bot ghi từ tin nhắn chữ/thoại thì là `manual`. */
  source?: "ocr" | "manual";
}

export interface DuplicateInfo {
  id: string;
  date: Date;
  supplier: string;
  totalAmount: number;
  categoryGroup: string;
  itemCount: number;
}

export type ApproveResult =
  | { ok: true; transaction: Transaction & { items: TransactionLine[] }; filesMoved: boolean }
  | { ok: false; duplicate: DuplicateInfo }
  | { ok: false; error: string; status: number };

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export async function approveDraft({
  userId,
  draft,
  formData,
  items,
  force,
  saveRule,
  source = "ocr",
}: ApproveInput): Promise<ApproveResult> {
  if (draft.userId !== userId) return { ok: false, error: "Không tìm thấy bản nháp", status: 404 };
  if (draft.status !== "Pending") {
    return { ok: false, error: "Bản nháp này đã được xử lý rồi", status: 409 };
  }

  const totalAmount = toVnd(formData.totalAmount);
  if (totalAmount === null) return { ok: false, error: "Tổng tiền không hợp lệ", status: 400 };

  // --- Kiểm tra trùng lặp: ngày hoá đơn + nhà cung cấp + tổng tiền -----------
  // Lọc thô ở DB theo ngày và số tiền, rồi so tên nhà cung cấp đã chuẩn hoá ở
  // tầng ứng dụng (Postgres không có sẵn hàm bỏ dấu tiếng Việt).
  if (!force) {
    const { start, end } = utcDayRange(formData.date);
    const sameDayAndAmount = await prisma.transaction.findMany({
      where: { userId, totalAmount, date: { gte: start, lte: end } },
      include: { items: true },
    });

    const target = normalizeSupplier(str(formData.supplier));
    const duplicate = sameDayAndAmount.find((t) => normalizeSupplier(t.supplier) === target);
    if (duplicate) {
      return {
        ok: false,
        duplicate: {
          id: duplicate.id,
          date: duplicate.date,
          supplier: duplicate.supplier,
          totalAmount: duplicate.totalAmount,
          categoryGroup: duplicate.categoryGroup,
          itemCount: duplicate.items.length,
        },
      };
    }
  }

  // --- Ghi chính thức --------------------------------------------------------
  const timestamp = Date.now();
  const { start: todayStart, end: todayEnd } = utcDayRange(new Date());

  const transaction = await prisma.$transaction(async (tx) => {
    const countToday = await tx.transaction.count({
      where: { userId, createdAt: { gte: todayStart, lte: todayEnd } },
    });

    const transactionId = `RCP-${timestamp}-${String(countToday + 1).padStart(4, "0")}`;

    const created = await tx.transaction.create({
      data: {
        id: transactionId,
        userId,
        date: new Date(formData.date),
        supplier: str(formData.supplier) || "N/A",
        type: formData.type,
        categoryGroup: str(formData.categoryGroup) || "Other",
        subGroup: str(formData.subGroup) || null,
        subtotal: toVnd(formData.subtotal) ?? totalAmount,
        tax: toVnd(formData.tax) ?? 0,
        // serviceCharge, subGroup, notes và paymentMethod trước đây bị bỏ rơi:
        // route cũ không đọc chúng khỏi formData và gán cứng paymentMethod="cash".
        serviceCharge: toVnd(formData.serviceCharge) ?? 0,
        discount: toVnd(formData.discount) ?? 0,
        totalAmount,
        paymentMethod: str(formData.paymentMethod) || "unknown",
        // Thiếu dòng này thì hoá đơn quét xong luôn rơi vào khoảng không: vào
        // sổ chi tiêu nhưng không đụng tới dư nợ thẻ nào.
        accountId: str(formData.accountId) || null,
        source,
        driveFileId: draft.driveFileIds,
        notes: str(formData.notes) || null,
        items:
          items.length > 0
            ? {
                create: items.map((item, idx) => ({
                  id: `ITM-${timestamp}-${String(idx + 1).padStart(4, "0")}`,
                  productName: str(item.productName),
                  quantity: Number(item.quantity) || 0,
                  unitPrice: toVnd(item.unitPrice) ?? 0,
                  totalPrice: toVnd(item.totalPrice) ?? 0,
                })),
              }
            : undefined,
      },
      include: { items: true },
    });

    // Phân bổ dự án: chọn ở bước quét (lưu trên bản nháp) hoặc sửa ở bước
    // duyệt — form duyệt luôn gửi bản cuối cùng.
    await applyProjectSplits(tx, {
      userId,
      transactionId: created.id,
      type: created.type,
      totalAmount: created.totalAmount,
      rawSplits: formData.projectSplits ?? [],
    });

    await tx.draftReceipt.update({
      where: { id: draft.id },
      data: { status: "Approved", reviewedAt: new Date(), transactionId: created.id },
    });

    // Danh bạ nhà cung cấp tự dựng dần từ hoá đơn đã duyệt — không bắt người
    // dùng khai báo trước như một bảng danh mục riêng.
    const normalized = normalizeSupplier(created.supplier);
    if (normalized) {
      await tx.vendor.upsert({
        where: { userId_normalizedName: { userId, normalizedName: normalized } },
        update: { vendorName: created.supplier, defaultCategoryGroup: created.categoryGroup },
        create: {
          vendorName: created.supplier,
          normalizedName: normalized,
          defaultCategoryGroup: created.categoryGroup,
          userId,
        },
      });

      // "Học" từ lần sửa tay này: lần sau gặp đúng nhà cung cấp đó, hoá đơn
      // được điền sẵn nhóm mà không cần hỏi Gemini.
      if (saveRule) {
        const existing = await tx.classificationRule.findFirst({
          where: { userId, matchType: "vendor", matchValue: normalized },
        });
        const ruleData = {
          transactionType: created.type,
          categoryGroup: created.categoryGroup,
          subGroup: created.subGroup,
          active: true,
          source: "learned",
          priority: LEARNED_RULE_PRIORITY,
        };
        if (existing) {
          await tx.classificationRule.update({ where: { id: existing.id }, data: ruleData });
        } else {
          await tx.classificationRule.create({
            data: { ...ruleData, matchType: "vendor", matchValue: normalized, userId },
          });
        }
      }
    }

    return created;
  });

  // Ảnh sang Approved_Invoices. Việc này nằm NGOÀI `$transaction` vì Drive
  // không rollback được — nếu hỏng thì dữ liệu vẫn đúng, chỉ là ảnh còn nằm ở
  // Review_Invoices và người dùng có thể tự dời.
  const fileIds = draft.driveFileIds.split(",").filter(Boolean);
  let filesMoved = true;
  if (fileIds.length > 0) {
    try {
      const drive = getDriveClient();
      const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
      await moveFilesTo(drive, fileIds, folderIds.APPROVED);
    } catch (error) {
      console.error("Approve: đã ghi DB nhưng không chuyển được ảnh:", error);
      filesMoved = false;
    }
  }

  await logOcr({
    userId,
    status: "INFO",
    message: `Đã duyệt ${transaction.id}: ${transaction.supplier} — ${transaction.totalAmount.toLocaleString("vi-VN")} đ${
      force ? " (bỏ qua cảnh báo trùng)" : ""
    }${saveRule ? " (đã lưu quy tắc)" : ""}`,
    fileId: draft.driveFileIds,
    fileName: draft.driveFileName,
  });

  return { ok: true, transaction, filesMoved };
}
