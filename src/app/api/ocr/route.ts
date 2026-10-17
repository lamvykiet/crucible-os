import { NextRequest, NextResponse } from "next/server";
import { aiErrorMessage } from "@/lib/aiRetry";
import { requireUser } from "@/lib/auth";
import {
  getDriveClient,
  INVOICE_ROOT_FOLDER_ID,
  getOrCreateFolderIds,
  uploadToDrive,
  moveFilesTo,
} from "@/lib/drive";
import { readReceipt } from "@/lib/receiptOcr";
import { logOcr } from "@/lib/ocrLog";

export const runtime = "nodejs";
// Quét tối đa 3 ảnh và có thể phải nhảy qua vài model khi model đầu quá tải
// hay chậm, nên lượt gọi dài hơn hẳn các route khác. Phải lớn hơn
// `OCR_BUDGET_MS` + phần Drive/Prisma hai đầu, nếu không Vercel giết hàm
// giữa chừng và ảnh kẹt lại ở Incoming mà không vào Error_Invoices.
// Thời gian chờ Gemini nằm ở `src/lib/receiptOcr.ts`.
export const maxDuration = 120;

// Hoá đơn chụp bằng điện thoại hiếm khi vượt 10MB. Chặn sớm để không nạp cả
// file khổng lồ vào RAM rồi mới base64 hoá.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MAX_FILES = 3;

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const driveFileIds: string[] = [];
  const fileNames: string[] = [];
  let errorFolderId: string | null = null;
  const startedAt = Date.now();

  try {
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "Chưa chọn tệp nào" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Tối đa ${MAX_FILES} ảnh cho một hoá đơn` }, { status: 400 });
    }

    // Duyệt toàn bộ tệp TRƯỚC khi upload bất cứ thứ gì. Bản cũ vừa duyệt vừa
    // upload, nên nếu ảnh thứ ba sai định dạng thì hai ảnh đầu đã nằm lại trên
    // Drive mà không ai biết để dọn.
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `"${file.name}" vượt quá ${MAX_FILE_BYTES / 1024 / 1024}MB` },
          { status: 413 }
        );
      }
      if (file.type && !ALLOWED_MIME.includes(file.type)) {
        return NextResponse.json({ error: `Định dạng không hỗ trợ: ${file.type}` }, { status: 415 });
      }
    }

    const buffers = await Promise.all(
      files.map(async (file) => ({ file, buffer: Buffer.from(await file.arrayBuffer()) }))
    );
    for (const { file } of buffers) fileNames.push(file.name);

    // Ảnh vào Incoming_Invoices và Ở NGUYÊN đó cho tới khi người dùng bấm
    // "Duyệt hoá đơn" — đúng luồng đã chốt: quét → Incoming → chờ duyệt.
    //
    // Chạy SONG SONG với Gemini: OCR chỉ cần bytes ảnh, không cần ảnh đã lên
    // Drive. Bản cũ upload xong mới gọi AI, nên vài giây upload bị cộng thẳng
    // vào thời gian người dùng ngồi chờ.
    const drive = getDriveClient();
    const uploads = (async () => {
      const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
      errorFolderId = folderIds.ERROR;
      for (const { file, buffer } of buffers) {
        const driveFileId = await uploadToDrive(drive, buffer, file.type, file.name, folderIds.INCOMING);
        if (driveFileId) driveFileIds.push(driveFileId);
      }
    })();

    // Gemini + quy tắc phân loại — xem `readReceipt`.
    const ocr = readReceipt(
      user.id,
      buffers.map(({ file, buffer }) => ({ data: buffer, mimeType: file.type }))
    );

    // allSettled chứ không all: nếu AI hỏng trước khi upload xong thì `all`
    // nhảy ngay vào catch, ảnh upload SAU lúc đó không được chuyển sang
    // Error_Invoices và kẹt vô hình ở Incoming.
    const [uploaded, scanned] = await Promise.allSettled([uploads, ocr]);
    if (scanned.status === "rejected") throw scanned.reason;
    if (uploaded.status === "rejected") throw uploaded.reason;
    const { data, suggestion, usedModel } = scanned.value;

    await logOcr({
      userId: user.id,
      status: "OK",
      message: `Quét ${driveFileIds.length} ảnh (${usedModel}): ${data.supplier ?? "không đọc được tên"} — ${
        data.totalAmount ?? "không đọc được tổng"
      }`,
      fileId: driveFileIds.join(","),
      fileName: fileNames.join(", "),
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      data,
      suggestion,
      driveFileIds,
      driveFileName: fileNames.join(", "),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    console.error("OCR Error:", error);

    // Ảnh đã lên Drive nhưng Gemini hỏng: đẩy sang Error_Invoices để không kẹt
    // vô hình trong Incoming. Bản cũ báo với người dùng rằng ảnh "đã vào hàng
    // đợi" trong khi hàng đợi chỉ đọc bản nháp — ảnh không bao giờ xuất hiện.
    let movedToError = false;
    if (driveFileIds.length > 0 && errorFolderId) {
      try {
        await moveFilesTo(getDriveClient(), driveFileIds, errorFolderId);
        movedToError = true;
      } catch (moveError) {
        console.error("OCR: không chuyển được ảnh lỗi sang Error_Invoices:", moveError);
      }
    }

    await logOcr({
      userId: user.id,
      status: "ERROR",
      message,
      fileId: driveFileIds.join(","),
      fileName: fileNames.join(", "),
      durationMs: Date.now() - startedAt,
    });

    // Nhật ký giữ nguyên văn của Google để còn lần ra nguyên nhân; người dùng
    // thì nhận câu nói rõ phải làm gì, không phải một đoạn URL kèm JSON.
    return NextResponse.json(
      { error: aiErrorMessage(error), detail: message, driveFileIds, movedToError },
      { status: 500 }
    );
  }
}
