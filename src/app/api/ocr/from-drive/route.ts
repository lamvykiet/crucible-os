import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getDriveClient,
  INVOICE_ROOT_FOLDER_ID,
  getOrCreateFolderIds,
  listFilesInFolder,
  moveFileTo,
} from "@/lib/drive";
import { genAI, GEMINI_VISION_MODEL } from "@/lib/gemini";
import { OCR_SCHEMA, OCR_PROMPT, toVnd } from "@/lib/invoice";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Quét lại một hoá đơn đang nằm trong `Error_Invoices`.
 *
 * Route này vốn đã tồn tại nhưng không màn hình nào gọi tới — nghĩa là khi
 * Gemini hỏng giữa chừng thì ảnh không có đường quay lại hàng đợi. Nay nó nhận
 * fileId từ danh sách lỗi (GET bên dưới), OCR lại, tạo thẳng bản nháp Pending
 * và trả ảnh về `Incoming_Invoices` để đi tiếp đúng luồng bình thường.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { fileId } = await req.json();
    if (!fileId) {
      return NextResponse.json({ success: false, error: "Thiếu fileId" }, { status: 400 });
    }

    const drive = getDriveClient();
    const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);

    const meta = await drive.files.get({ fileId, fields: "id, name, mimeType, size, parents" });
    const file = meta.data;

    if (!file?.mimeType) {
      return NextResponse.json({ success: false, error: "File không hợp lệ" }, { status: 400 });
    }
    // Chỉ cho phép quét lại file thuộc thư mục lỗi. Nếu không, một fileId bất kỳ
    // trong Drive của tài khoản dùng chung đều có thể bị đẩy qua Gemini.
    if (!(file.parents ?? []).includes(folderIds.ERROR)) {
      return NextResponse.json(
        { success: false, error: "File không nằm trong Error_Invoices" },
        { status: 403 }
      );
    }
    if (file.size && Number(file.size) > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: `File vượt quá ${MAX_FILE_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    const fileRes = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
    const buffer = Buffer.from(fileRes.data as ArrayBuffer);

    const model = genAI.getGenerativeModel({
      model: GEMINI_VISION_MODEL,
      generationConfig: { responseMimeType: "application/json", responseSchema: OCR_SCHEMA },
    });

    const result = await model.generateContent([
      OCR_PROMPT,
      { inlineData: { data: buffer.toString("base64"), mimeType: file.mimeType } },
    ]);
    const data = JSON.parse(result.response.text());

    // Import động: `prisma` chỉ cần khi OCR đã thành công, và giữ import ở đây
    // để route không kéo Prisma vào mọi lần dựng bundle.
    const { prisma } = await import("@/lib/prisma");

    const draft = await prisma.draftReceipt.create({
      data: {
        status: "Pending",
        date: data.date ? new Date(data.date) : null,
        supplier: data.supplier || null,
        type: "Expense",
        subtotal: toVnd(data.subtotal),
        tax: toVnd(data.tax),
        serviceCharge: toVnd(data.serviceCharge),
        discount: toVnd(data.discount),
        totalAmount: toVnd(data.totalAmount),
        paymentMethod: data.paymentMethod || "unknown",
        language: data.language || null,
        notes: data.notes || null,
        driveFileIds: fileId,
        driveFileName: file.name || null,
        userId: user.id,
        items: Array.isArray(data.items) && data.items.length > 0 ? {
          create: data.items.map((item: any) => ({
            productName: item.productName || "",
            quantity: Number(item.quantity) || 0,
            unitPrice: toVnd(item.unitPrice) ?? 0,
            totalPrice: toVnd(item.totalPrice) ?? 0,
            suggestedCategoryGroup: item.suggestedCategoryGroup || null,
            confidence: item.confidence === undefined || item.confidence === null ? null : Number(item.confidence),
          })),
        } : undefined,
      },
    });

    await moveFileTo(drive, fileId, folderIds.INCOMING);

    return NextResponse.json({ success: true, draftId: draft.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("OCR from drive Error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Danh sách hoá đơn đã quét hỏng, để người dùng bấm quét lại. */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const drive = getDriveClient();
    const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
    const files = await listFilesInFolder(drive, folderIds.ERROR);

    return NextResponse.json({
      success: true,
      count: files.length,
      files: files.map((f) => ({ id: f.id, name: f.name })),
    });
  } catch (error) {
    console.error("List error invoices failed:", error);
    return NextResponse.json({ success: false, error: "Server Error", count: 0, files: [] }, { status: 500 });
  }
}
