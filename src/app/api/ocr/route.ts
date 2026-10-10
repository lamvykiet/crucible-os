import { NextRequest, NextResponse } from "next/server";
import { GEMINI_VISION_MODEL, GEMINI_VISION_CHAIN, modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry, aiErrorMessage } from "@/lib/aiRetry";
import { requireUser } from "@/lib/auth";
import {
  getDriveClient,
  INVOICE_ROOT_FOLDER_ID,
  getOrCreateFolderIds,
  uploadToDrive,
  moveFilesTo,
} from "@/lib/drive";
import { OCR_SCHEMA, OCR_PROMPT } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { classify, RULE_ORDER } from "@/lib/classify";
import { logOcr } from "@/lib/ocrLog";

export const runtime = "nodejs";
// Quét tối đa 3 ảnh và có thể phải nhảy qua vài model khi model đầu quá tải
// hay chậm, nên lượt gọi dài hơn hẳn các route khác. Phải lớn hơn
// `OCR_BUDGET_MS` + phần Drive/Prisma hai đầu, nếu không Vercel giết hàm
// giữa chừng và ảnh kẹt lại ở Incoming mà không vào Error_Invoices.
export const maxDuration = 120;

/**
 * Thời gian cho MỘT lượt gọi Gemini, và cho cả chuỗi thử lại.
 *
 * Bản cũ là 20 s / 45 s — ngắn hơn thời gian đọc bình thường: nhật ký OCR ghi
 * lượt thành công mất 11–30 s, và đo 10/10 thì hai model dự phòng mất 23 s cho
 * một hoá đơn 13 món. Mọi lượt hỏng 07/10 và 10/10 đều dừng ở đúng ~20 s.
 * 40 s đủ cho model chậm nhất đọc xong, mà lượt hỏng vẫn còn chỗ nhảy sang
 * model nhanh (2.5-flash-lite, ~9 s).
 */
const OCR_ATTEMPT_MS = 40_000;
const OCR_BUDGET_MS = 95_000;

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
    const imageParts = buffers.map(({ file, buffer }) => ({
      inlineData: { data: buffer.toString("base64"), mimeType: file.type },
    }));

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

    // Đi qua CHUỖI model chứ không gọi thẳng một model.
    //
    // Lỗi gặp thật ngày 03/10: `gemini-3.6-flash` trả 503 "high demand" và cả
    // lượt quét hỏng, ảnh bị đẩy sang Error_Invoices — trong khi quá tải là
    // chuyện của riêng từng model, model khác lúc đó vẫn chạy. Chuỗi dự phòng
    // của OCR xếp model NHANH lên trước — xem `GEMINI_VISION_CHAIN`.
    const models = modelsWithFallback(
      {
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: OCR_SCHEMA,
        },
      },
      GEMINI_VISION_MODEL,
      GEMINI_VISION_CHAIN
    );
    const ocr = generateWithRetry(models, [OCR_PROMPT, ...imageParts], {
      timeoutMs: OCR_ATTEMPT_MS,
      totalBudgetMs: OCR_BUDGET_MS,
    });

    // allSettled chứ không all: nếu AI hỏng trước khi upload xong thì `all`
    // nhảy ngay vào catch, ảnh upload SAU lúc đó không được chuyển sang
    // Error_Invoices và kẹt vô hình ở Incoming.
    const [uploaded, scanned] = await Promise.allSettled([uploads, ocr]);
    if (scanned.status === "rejected") throw scanned.reason;
    if (uploaded.status === "rejected") throw uploaded.reason;
    const result = scanned.value;
    const data = JSON.parse(result.response.text());

    // Quy tắc trước, Gemini sau: nếu người dùng đã dạy hệ thống nhà cung cấp này
    // thuộc nhóm nào thì dùng luôn, gợi ý của mô hình chỉ là phương án dự phòng.
    const rules = await prisma.classificationRule.findMany({
      where: { userId: user.id, active: true },
      orderBy: RULE_ORDER,
    });
    const suggestion = classify(rules, data);

    await logOcr({
      userId: user.id,
      status: "OK",
      message: `Quét ${driveFileIds.length} ảnh (${result.usedModel}): ${data.supplier ?? "không đọc được tên"} — ${
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
