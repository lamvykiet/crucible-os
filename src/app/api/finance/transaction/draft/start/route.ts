import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  getDriveClient,
  INVOICE_ROOT_FOLDER_ID,
  getOrCreateFolderIds,
  moveFilesTo,
} from "@/lib/drive";

export const runtime = "nodejs";

/**
 * Bước 2: mở một bản nháp ra duyệt.
 *
 * Đây là lúc ảnh rời `Incoming_Invoices` sang `Review_Invoices` — nghĩa là
 * "đang có người xem hoá đơn này". Việc ghi vào DB phải chờ tới bước 3.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { draftId } = await req.json();
    if (!draftId) {
      return NextResponse.json({ success: false, error: "Thiếu draftId" }, { status: 400 });
    }

    const draft = await prisma.draftReceipt.findUnique({
      where: { id: draftId },
      include: { items: true },
    });

    if (!draft || draft.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bản nháp" }, { status: 404 });
    }

    const fileIds = draft.driveFileIds.split(",").filter(Boolean);
    if (fileIds.length > 0) {
      const drive = getDriveClient();
      const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
      await moveFilesTo(drive, fileIds, folderIds.REVIEW);
    }

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error("Start review error:", error);
    const message = error instanceof Error ? error.message : "Không mở được bản nháp";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
