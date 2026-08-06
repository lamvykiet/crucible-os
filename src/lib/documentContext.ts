import { prisma } from "@/lib/prisma";
import { driveClient, knowledgeRoots, isWithinAllowedFolder } from "@/lib/driveAccess";
import { prepareDocument, canPrepare, usesGeminiFile, geminiFileStillValid } from "@/lib/documentText";

/**
 * Lấy nội dung một tài liệu Drive về dạng dùng được cho AI, có cache.
 *
 * Dùng chung cho `/api/knowledge/document-context` (khung chat) và
 * `/api/knowledge/studio` (tóm tắt, bản đồ tư duy, thẻ ghi nhớ) — hai nơi này
 * cần đúng một thứ, không có lý do gì mỗi nơi tự tải và tự trích một lần.
 */

export type ContextMode = "text" | "file";

export interface DocumentContext {
  ok: true;
  ready: boolean;
  materialId?: string;
  name: string;
  mimeType: string;
  mode?: ContextMode;
  cached?: boolean;
  text?: string;
  chars?: number;
  truncated?: boolean;
  fileUri?: string;
  reason?: string;
}

export interface DocumentContextError {
  ok: false;
  status: number;
  error: string;
}

export async function resolveDocumentContext(
  fileId: string,
  userId: string
): Promise<DocumentContext | DocumentContextError> {
  const roots = knowledgeRoots();
  if (roots.length === 0) {
    return { ok: false, status: 500, error: "Chưa cấu hình thư mục Drive" };
  }

  const drive = driveClient();
  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, size, modifiedTime, parents",
  });

  const allowed = await isWithinAllowedFolder(drive, fileId, meta.data.parents ?? undefined, roots);
  if (!allowed) {
    // 404 chứ không 403 — đừng xác nhận cho người gọi biết fileId có tồn tại.
    return { ok: false, status: 404, error: "Not found" };
  }

  const name = meta.data.name || "(không tên)";
  const mimeType = meta.data.mimeType || "application/octet-stream";
  const modifiedAt = meta.data.modifiedTime ? new Date(meta.data.modifiedTime) : null;

  if (!canPrepare(mimeType)) {
    return {
      ok: true,
      ready: false,
      name,
      mimeType,
      reason: "Định dạng này chưa đọc được nội dung (video, tệp nén...)",
    };
  }

  const cached = await prisma.material.findUnique({ where: { driveFileId: fileId } });
  const sourceUnchanged =
    cached?.sourceModifiedAt != null &&
    modifiedAt != null &&
    cached.sourceModifiedAt.getTime() === modifiedAt.getTime();

  if (sourceUnchanged && usesGeminiFile(mimeType)) {
    if (cached!.geminiFileUri && geminiFileStillValid(cached!.geminiFileExpiresAt)) {
      return {
        ok: true, ready: true, cached: true, mode: "file",
        materialId: cached!.id, name, mimeType, fileUri: cached!.geminiFileUri,
      };
    }
  } else if (sourceUnchanged && cached?.contentText) {
    return {
      ok: true, ready: true, cached: true, mode: "text",
      materialId: cached.id, name, mimeType,
      text: cached.contentText, chars: cached.contentChars ?? cached.contentText.length,
    };
  }

  const prepared = await prepareDocument(drive, { id: fileId, name, mimeType, size: meta.data.size });

  if (!prepared || (prepared.mode === "text" && !prepared.text?.trim())) {
    return {
      ok: true, ready: false, name, mimeType,
      reason: "Không trích được chữ nào từ tài liệu này",
    };
  }

  const common = { title: name, mimeType, sourceModifiedAt: modifiedAt, contentFetchedAt: new Date() };
  const payload =
    prepared.mode === "text"
      ? {
          ...common,
          contentText: prepared.text!,
          contentChars: prepared.chars ?? prepared.text!.length,
          geminiFileUri: null, geminiFileName: null, geminiFileExpiresAt: null,
        }
      : {
          ...common,
          contentText: null, contentChars: null,
          geminiFileUri: prepared.fileUri!,
          geminiFileName: prepared.fileName ?? null,
          geminiFileExpiresAt: prepared.expiresAt ?? null,
        };

  const material = await prisma.material.upsert({
    where: { driveFileId: fileId },
    update: payload,
    create: { driveFileId: fileId, type: mimeType.split("/").pop() || "file", userId, ...payload },
  });

  return prepared.mode === "text"
    ? {
        ok: true, ready: true, cached: false, mode: "text",
        materialId: material.id, name, mimeType,
        text: prepared.text, chars: prepared.chars, truncated: prepared.truncated,
      }
    : {
        ok: true, ready: true, cached: false, mode: "file",
        materialId: material.id, name, mimeType, fileUri: prepared.fileUri,
      };
}
