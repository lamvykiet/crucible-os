import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  getDriveClient,
  deleteFile,
  moveFilesTo,
  getOrCreateFolderIds,
  INVOICE_ROOT_FOLDER_ID,
} from "@/lib/drive";

export const runtime = "nodejs";

/**
 * Xử lý hoá đơn bị phát hiện trùng — chỉ chạy khi người dùng đã bấm chọn.
 *
 * Hai hành động ở đây đều huỷ bản nháp; lựa chọn thứ ba ("đây là hai hoá đơn
 * khác nhau, vẫn ghi") không đi qua route này mà gọi lại `process-ocr` với
 * `force: true`.
 *
 *   delete → xoá vĩnh viễn ảnh trên Drive + xoá giao dịch vừa tạo (nếu có)
 *            + xoá luôn bản nháp.
 *   trash  → chuyển ảnh vào Trash_Invoices + xoá giao dịch vừa tạo (nếu có)
 *            + đánh dấu bản nháp Rejected để còn dấu vết.
 *
 * "Giao dịch vừa tạo" thường không tồn tại, vì `process-ocr` kiểm tra trùng
 * TRƯỚC khi ghi. Trường `transactionId` vẫn được dọn để phòng trường hợp người
 * dùng đã chọn "vẫn ghi" ở lần trước rồi đổi ý.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { draftId, action } = await req.json();

    if (!draftId || !["delete", "trash"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "draftId hoặc action không hợp lệ" },
        { status: 400 }
      );
    }

    const draft = await prisma.draftReceipt.findUnique({ where: { id: draftId } });
    if (!draft || draft.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bản nháp" }, { status: 404 });
    }

    const fileIds = draft.driveFileIds.split(",").filter(Boolean);
    const drive = getDriveClient();

    if (action === "delete") {
      for (const fileId of fileIds) {
        await deleteFile(drive, fileId);
      }
    } else {
      const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
      await moveFilesTo(drive, fileIds, folderIds.TRASH);
    }

    await prisma.$transaction(async (tx) => {
      if (draft.transactionId) {
        // deleteMany chứ không phải delete: giao dịch có thể đã bị xoá tay ở
        // màn hình Lịch sử, và khi đó `delete` sẽ ném lỗi P2025.
        await tx.transaction.deleteMany({ where: { id: draft.transactionId, userId: user.id } });
      }

      if (action === "delete") {
        await tx.draftReceipt.delete({ where: { id: draft.id } });
      } else {
        await tx.draftReceipt.update({
          where: { id: draft.id },
          data: { status: "Rejected", reviewedAt: new Date(), transactionId: null },
        });
      }
    });

    return NextResponse.json({
      success: true,
      action,
      deletedTransactionId: draft.transactionId ?? null,
    });
  } catch (error) {
    console.error("Resolve duplicate error:", error);
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
