import { NextRequest, NextResponse } from "next/server";
import { genAI, GEMINI_VISION_MODEL } from "@/lib/gemini";
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

    const drive = getDriveClient();
    const folderIds = await getOrCreateFolderIds(drive, INVOICE_ROOT_FOLDER_ID);
    errorFolderId = folderIds.ERROR;

    const imageParts = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      // Ảnh vào Incoming_Invoices và Ở NGUYÊN đó cho tới khi người dùng bấm
      // "Duyệt hoá đơn" — đúng luồng đã chốt: quét → Incoming → chờ duyệt.
      const driveFileId = await uploadToDrive(drive, buffer, file.type, file.name, folderIds.INCOMING);
      if (driveFileId) driveFileIds.push(driveFileId);
      fileNames.push(file.name);

      imageParts.push({
        inlineData: { data: buffer.toString("base64"), mimeType: file.type },
      });
    }

    const model = genAI.getGenerativeModel({
      model: GEMINI_VISION_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: OCR_SCHEMA,
      },
    });

    const result = await model.generateContent([OCR_PROMPT, ...imageParts]);
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
      message: `Quét ${driveFileIds.length} ảnh: ${data.supplier ?? "không đọc được tên"} — ${
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

    return NextResponse.json({ error: message, driveFileIds, movedToError }, { status: 500 });
  }
}
