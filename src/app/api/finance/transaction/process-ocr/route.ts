import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  getDriveClient,
  moveFilesTo,
  getOrCreateFolderIds,
  INVOICE_ROOT_FOLDER_ID,
} from "@/lib/drive";
import { normalizeSupplier, utcDayRange, toVnd } from "@/lib/invoice";
import { LEARNED_RULE_PRIORITY } from "@/lib/classify";
import { logOcr } from "@/lib/ocrLog";

export const runtime = "nodejs";

/**
 * Bước 3: duyệt bản nháp → ghi chính thức vào `Transaction` + `TransactionLine`.
 *
 * Hai điểm khác hẳn bản cũ:
 *
 * 1. Không tự xoá gì cả. Bản cũ phát hiện trùng là gọi thẳng `files.delete` xoá
 *    vĩnh viễn ảnh trên Drive — người dùng không kịp nhìn, không có đường lùi,
 *    kể cả khi đó chỉ là hai lần mua giống nhau trong cùng một ngày. Nay route
 *    này chỉ *báo cáo* trùng lặp rồi dừng; hành động do người dùng chọn
 *    (`force: true` để vẫn ghi, hoặc `resolve-duplicate` để huỷ).
 *
 * 2. Dòng tổng, các dòng chi tiết và việc đổi trạng thái bản nháp nằm chung một
 *    `$transaction`. Bản cũ tạo `Transaction` trước rồi mới tạo items; lỗi giữa
 *    chừng để lại một giao dịch không có chi tiết mà không ai biết.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const { draftId, formData, items, force, saveRule } = body;

    if (!draftId) {
      return NextResponse.json({ success: false, error: "Thiếu draftId" }, { status: 400 });
    }
    if (!formData?.date || !formData?.type || !formData?.totalAmount) {
      return NextResponse.json(
        { success: false, error: "Thiếu ngày, loại giao dịch hoặc tổng tiền" },
        { status: 400 }
      );
    }

    const draft = await prisma.draftReceipt.findUnique({ where: { id: draftId } });
    if (!draft || draft.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bản nháp" }, { status: 404 });
    }
    if (draft.status !== "Pending") {
      return NextResponse.json(
        { success: false, error: "Bản nháp này đã được xử lý rồi" },
        { status: 409 }
      );
    }

    const totalAmount = toVnd(formData.totalAmount);
    if (totalAmount === null) {
      return NextResponse.json({ success: false, error: "Tổng tiền không hợp lệ" }, { status: 400 });
    }

    // --- Kiểm tra trùng lặp: ngày hoá đơn + nhà cung cấp + tổng tiền ---------
    // Lọc thô ở DB theo ngày và số tiền, rồi so tên nhà cung cấp đã chuẩn hoá ở
    // tầng ứng dụng (Postgres không có sẵn hàm bỏ dấu tiếng Việt). Số bản ghi
    // lọt qua bộ lọc thô luôn rất nhỏ.
    if (!force) {
      const { start, end } = utcDayRange(formData.date);
      const sameDayAndAmount = await prisma.transaction.findMany({
        where: { userId: user.id, totalAmount, date: { gte: start, lte: end } },
        include: { items: true },
      });

      const target = normalizeSupplier(formData.supplier);
      const duplicate = sameDayAndAmount.find((t) => normalizeSupplier(t.supplier) === target);

      if (duplicate) {
        return NextResponse.json({
          success: false,
          isDuplicate: true,
          duplicate: {
            id: duplicate.id,
            date: duplicate.date,
            supplier: duplicate.supplier,
            totalAmount: duplicate.totalAmount,
            categoryGroup: duplicate.categoryGroup,
            itemCount: duplicate.items.length,
          },
        });
      }
    }

    // --- Ghi chính thức ------------------------------------------------------
    const timestamp = Date.now();
    const { start: todayStart, end: todayEnd } = utcDayRange(new Date());

    const transaction = await prisma.$transaction(async (tx) => {
      const countToday = await tx.transaction.count({
        where: { userId: user.id, createdAt: { gte: todayStart, lte: todayEnd } },
      });

      const transactionId = `RCP-${timestamp}-${String(countToday + 1).padStart(4, "0")}`;
      const lines = Array.isArray(items) ? items : [];

      const created = await tx.transaction.create({
        data: {
          id: transactionId,
          userId: user.id,
          date: new Date(formData.date),
          supplier: formData.supplier || "N/A",
          type: formData.type,
          categoryGroup: formData.categoryGroup || "Other",
          subGroup: formData.subGroup || null,
          subtotal: toVnd(formData.subtotal) ?? totalAmount,
          tax: toVnd(formData.tax) ?? 0,
          // serviceCharge, subGroup, notes và paymentMethod trước đây bị bỏ rơi:
          // route cũ không đọc chúng khỏi formData và gán cứng paymentMethod="cash".
          serviceCharge: toVnd(formData.serviceCharge) ?? 0,
          discount: toVnd(formData.discount) ?? 0,
          totalAmount,
          paymentMethod: formData.paymentMethod || "unknown",
          source: "ocr",
          driveFileId: draft.driveFileIds,
          notes: formData.notes || null,
          items:
            lines.length > 0
              ? {
                  create: lines.map((item: any, idx: number) => ({
                    id: `ITM-${timestamp}-${String(idx + 1).padStart(4, "0")}`,
                    productName: item.productName || "",
                    quantity: Number(item.quantity) || 0,
                    unitPrice: toVnd(item.unitPrice) ?? 0,
                    totalPrice: toVnd(item.totalPrice) ?? 0,
                  })),
                }
              : undefined,
        },
        include: { items: true },
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
          where: { userId_normalizedName: { userId: user.id, normalizedName: normalized } },
          update: { vendorName: created.supplier, defaultCategoryGroup: created.categoryGroup },
          create: {
            vendorName: created.supplier,
            normalizedName: normalized,
            defaultCategoryGroup: created.categoryGroup,
            userId: user.id,
          },
        });

        // "Học" từ lần sửa tay này: lần sau gặp đúng nhà cung cấp đó, hoá đơn
        // được điền sẵn nhóm mà không cần hỏi Gemini.
        if (saveRule) {
          const existing = await tx.classificationRule.findFirst({
            where: { userId: user.id, matchType: "vendor", matchValue: normalized },
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
              data: { ...ruleData, matchType: "vendor", matchValue: normalized, userId: user.id },
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
      userId: user.id,
      status: "INFO",
      message: `Đã duyệt ${transaction.id}: ${transaction.supplier} — ${transaction.totalAmount.toLocaleString("vi-VN")} đ${
        force ? " (bỏ qua cảnh báo trùng)" : ""
      }${saveRule ? " (đã lưu quy tắc)" : ""}`,
      fileId: draft.driveFileIds,
      fileName: draft.driveFileName,
    });

    return NextResponse.json({ success: true, data: transaction, filesMoved });
  } catch (error) {
    console.error("Failed to process OCR transaction:", error);
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
