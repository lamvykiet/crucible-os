import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ProjectSplitError } from "@/lib/projectLedger";
import { approveDraft } from "@/lib/approveDraft";

export const runtime = "nodejs";

/**
 * Bước 3: duyệt bản nháp → ghi chính thức vào `Transaction` + `TransactionLine`.
 *
 * Phần ghi sổ nằm ở `src/lib/approveDraft.ts`, dùng chung với bot Telegram.
 * Route này chỉ còn kiểm đầu vào và đổi kết quả ra JSON cho hộp thoại duyệt.
 *
 * Phát hiện trùng thì chỉ *báo cáo* rồi dừng; hành động do người dùng chọn
 * (`force: true` để vẫn ghi, hoặc `resolve-duplicate` để huỷ).
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

    const result = await approveDraft({
      userId: user.id,
      draft,
      formData,
      items: Array.isArray(items) ? items : [],
      force,
      saveRule,
    });

    if (result.ok) {
      return NextResponse.json({ success: true, data: result.transaction, filesMoved: result.filesMoved });
    }
    if ("duplicate" in result) {
      return NextResponse.json({ success: false, isDuplicate: true, duplicate: result.duplicate });
    }
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  } catch (error) {
    if (error instanceof ProjectSplitError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    console.error("Failed to process OCR transaction:", error);
    const message = error instanceof Error ? error.message : "Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
