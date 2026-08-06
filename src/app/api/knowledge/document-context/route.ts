import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { driveClient, knowledgeRoots, isWithinAllowedFolder } from "@/lib/driveAccess";
import { prepareDocument, canPrepare, usesGeminiFile, geminiFileStillValid } from "@/lib/documentText";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Chuẩn bị một tài liệu Drive để khung chat dùng làm ngữ cảnh.
 *
 * Trả về một trong hai dạng:
 *   { mode: "text", text }                → nội dung đã trích, client gửi kèm câu hỏi
 *   { mode: "file", fileUri, fileMimeType } → tệp đã nằm sẵn trên Gemini Files API
 *
 * Cả hai đều được cache trong bảng `Material`. Cache text hết hiệu lực khi
 * `modifiedTime` bên Drive đổi; cache file hết hiệu lực sau 48 giờ theo quy định
 * của Gemini.
 *
 * Kiểm soát truy cập giống `/api/drive/download`: chỉ nhận file nằm trong cây
 * thư mục đã cấu hình, vì cả ứng dụng dùng chung một refresh token Drive nên
 * bất kỳ fileId nào cũng tải được nếu không chặn.
 */

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { fileId } = await req.json();
    if (!fileId) {
      return NextResponse.json({ success: false, error: "Thiếu fileId" }, { status: 400 });
    }

    const roots = knowledgeRoots();
    if (roots.length === 0) {
      return NextResponse.json({ success: false, error: "Chưa cấu hình thư mục Drive" }, { status: 500 });
    }

    const drive = driveClient();
    const meta = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size, modifiedTime, parents",
    });

    const allowed = await isWithinAllowedFolder(drive, fileId, meta.data.parents ?? undefined, roots);
    if (!allowed) {
      // 404 chứ không 403 — đừng xác nhận cho người gọi biết fileId có tồn tại.
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const name = meta.data.name || "(không tên)";
    const mimeType = meta.data.mimeType || "application/octet-stream";
    const modifiedAt = meta.data.modifiedTime ? new Date(meta.data.modifiedTime) : null;

    if (!canPrepare(mimeType)) {
      return NextResponse.json({
        success: true,
        ready: false,
        name,
        mimeType,
        reason: "Định dạng này chưa đọc được nội dung (video, file nén...)",
      });
    }

    const cached = await prisma.material.findUnique({ where: { driveFileId: fileId } });
    const sourceUnchanged =
      cached?.sourceModifiedAt != null &&
      modifiedAt != null &&
      cached.sourceModifiedAt.getTime() === modifiedAt.getTime();

    // --- Cache hợp lệ ---------------------------------------------------------
    if (sourceUnchanged && usesGeminiFile(mimeType)) {
      if (cached!.geminiFileUri && geminiFileStillValid(cached!.geminiFileExpiresAt)) {
        return NextResponse.json({
          success: true, ready: true, cached: true, mode: "file",
          materialId: cached!.id, name, mimeType,
          fileUri: cached!.geminiFileUri, fileMimeType: mimeType,
        });
      }
    } else if (sourceUnchanged && cached?.contentText) {
      return NextResponse.json({
        success: true, ready: true, cached: true, mode: "text",
        materialId: cached.id, name, mimeType,
        chars: cached.contentChars ?? cached.contentText.length,
        text: cached.contentText,
      });
    }

    // --- Chuẩn bị lại ---------------------------------------------------------
    const prepared = await prepareDocument(drive, { id: fileId, name, mimeType, size: meta.data.size });

    if (!prepared || (prepared.mode === "text" && !prepared.text?.trim())) {
      return NextResponse.json({
        success: true, ready: false, name, mimeType,
        reason: "Không trích được chữ nào từ tài liệu này",
      });
    }

    const common = {
      title: name,
      mimeType,
      sourceModifiedAt: modifiedAt,
      contentFetchedAt: new Date(),
    };
    const payload =
      prepared.mode === "text"
        ? { ...common, contentText: prepared.text!, contentChars: prepared.chars ?? prepared.text!.length,
            geminiFileUri: null, geminiFileName: null, geminiFileExpiresAt: null }
        : { ...common, contentText: null, contentChars: null,
            geminiFileUri: prepared.fileUri!, geminiFileName: prepared.fileName ?? null,
            geminiFileExpiresAt: prepared.expiresAt ?? null };

    const material = await prisma.material.upsert({
      where: { driveFileId: fileId },
      update: payload,
      create: {
        driveFileId: fileId,
        type: mimeType.split("/").pop() || "file",
        userId: user.id,
        ...payload,
      },
    });

    return prepared.mode === "text"
      ? NextResponse.json({
          success: true, ready: true, cached: false, mode: "text",
          materialId: material.id, name, mimeType,
          chars: prepared.chars, truncated: prepared.truncated, text: prepared.text,
        })
      : NextResponse.json({
          success: true, ready: true, cached: false, mode: "file",
          materialId: material.id, name, mimeType,
          fileUri: prepared.fileUri, fileMimeType: mimeType,
        });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được tài liệu";
    console.error("document-context error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
