import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drive_v3 } from "googleapis";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

/**
 * Chuẩn bị nội dung một tài liệu Drive để đưa vào ngữ cảnh chat.
 *
 * Có đúng hai đường, chọn theo định dạng:
 *
 * 1. `text` — Google Docs/Sheets/Slides, .docx/.xlsx/.pptx, .txt/.md/.csv.
 *    Drive tự export ra text, gần như tức thì và không tốn quota AI.
 *
 * 2. `file` — PDF và các định dạng nhị phân khác. Tải từ Drive rồi đẩy lên
 *    Gemini Files API một lần, sau đó mọi câu hỏi chỉ tham chiếu tới `fileUri`.
 *
 * Đường thứ hai thay cho ý tưởng ban đầu là bắt Gemini *chép lại* toàn văn PDF.
 * Đo trên một file CFA 7,67 MB: chép toàn văn ra 190.938 ký tự mất **260 giây**,
 * quá xa giới hạn function của Vercel. Cũng file đó, upload lên Files API mất
 * 2,8 giây và mỗi câu hỏi sau đó chỉ 26–33 giây. Chép lại toàn văn vừa chậm vừa
 * thừa: thứ người dùng cần là câu trả lời, không phải bản transcript.
 */

const MAX_BYTES = 20 * 1024 * 1024;
export const MAX_TEXT_CHARS = 400_000;

// Gemini giữ file 48 giờ. Trừ hao 1 giờ để không dùng nhầm URI sắp hết hạn.
const EXPIRY_SAFETY_MS = 60 * 60 * 1000;

const GOOGLE_DOC = "application/vnd.google-apps.document";
const GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDE = "application/vnd.google-apps.presentation";

const OOXML_TO_GOOGLE: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": GOOGLE_DOC,
  "application/msword": GOOGLE_DOC,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": GOOGLE_SHEET,
  "application/vnd.ms-excel": GOOGLE_SHEET,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": GOOGLE_SLIDE,
  "application/vnd.ms-powerpoint": GOOGLE_SLIDE,
  "application/rtf": GOOGLE_DOC,
  "application/vnd.oasis.opendocument.text": GOOGLE_DOC,
};

/** Định dạng Gemini đọc trực tiếp được khi đưa qua Files API. */
const GEMINI_NATIVE = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];

const PLAIN_EXACT = ["application/json", "application/xml"];
const isPlain = (m: string) => m.startsWith("text/") || PLAIN_EXACT.includes(m);
const isGoogleNative = (m: string) => m === GOOGLE_DOC || m === GOOGLE_SHEET || m === GOOGLE_SLIDE;

export type PrepareMode = "text" | "file";

export interface PreparedDocument {
  mode: PrepareMode;
  /** mode === "text" */
  text?: string;
  chars?: number;
  truncated?: boolean;
  /** mode === "file" */
  fileUri?: string;
  fileName?: string;
  fileMimeType?: string;
  expiresAt?: Date;
}

export function canPrepare(mimeType: string): boolean {
  return (
    isGoogleNative(mimeType) ||
    mimeType in OOXML_TO_GOOGLE ||
    isPlain(mimeType) ||
    GEMINI_NATIVE.includes(mimeType)
  );
}

/** true nếu tài liệu này đi đường Files API thay vì export text. */
export function usesGeminiFile(mimeType: string): boolean {
  return GEMINI_NATIVE.includes(mimeType) && !isPlain(mimeType);
}

async function downloadBuffer(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(res.data as ArrayBuffer);
}

async function exportText(drive: drive_v3.Drive, fileId: string, googleMime: string): Promise<string> {
  const exportMime = googleMime === GOOGLE_SHEET ? "text/csv" : "text/plain";
  const res = await drive.files.export({ fileId, mimeType: exportMime }, { responseType: "arraybuffer" });
  return Buffer.from(res.data as ArrayBuffer).toString("utf-8");
}

/** Nhờ Drive chuyển .docx/.xlsx sang định dạng Google, export text rồi dọn bản sao. */
async function convertAndExport(drive: drive_v3.Drive, fileId: string, targetMime: string): Promise<string> {
  let copyId: string | null = null;
  try {
    // files.copy kèm mimeType đích chính là cách Drive chuyển .docx sang Google
    // Docs: bản gốc không bị đụng tới, ta chỉ đọc text từ bản sao.
    const copied = await drive.files.copy({
      fileId,
      requestBody: { name: `__tmp_extract_${fileId}`, mimeType: targetMime },
      fields: "id",
    });
    copyId = copied.data.id ?? null;
    if (!copyId) throw new Error("Drive không tạo được bản sao để chuyển đổi");

    return await exportText(drive, copyId, targetMime);
  } finally {
    if (copyId) {
      // Bản sao chỉ để lấy text — luôn dọn, kể cả khi export hỏng, để không rác
      // Drive của người dùng.
      await drive.files.delete({ fileId: copyId }).catch((e) => {
        console.error("Không xoá được bản sao tạm:", copyId, e);
      });
    }
  }
}

/**
 * Đẩy file lên Gemini Files API.
 *
 * SDK chỉ nhận đường dẫn nên phải ghi tạm ra đĩa. Trên Vercel chỉ `/tmp` ghi
 * được, và `tmpdir()` trỏ đúng vào đó.
 */
async function uploadToGemini(
  buffer: Buffer,
  mimeType: string,
  displayName: string
): Promise<{ uri: string; name: string; expiresAt: Date }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY");

  const fileManager = new GoogleAIFileManager(apiKey);
  const tmpPath = join(tmpdir(), `crucible-${randomUUID()}`);

  try {
    await writeFile(tmpPath, buffer);
    const uploaded = await fileManager.uploadFile(tmpPath, { mimeType, displayName });

    // Video/audio cần thời gian xử lý; PDF thường ACTIVE ngay.
    let file = uploaded.file;
    const deadline = Date.now() + 60_000;
    while (file.state === FileState.PROCESSING && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      file = await fileManager.getFile(uploaded.file.name);
    }
    if (file.state !== FileState.ACTIVE) {
      throw new Error(`Gemini không xử lý được tệp (trạng thái ${file.state})`);
    }

    return {
      uri: file.uri,
      name: file.name,
      expiresAt: file.expirationTime ? new Date(file.expirationTime) : new Date(Date.now() + 47 * 3600_000),
    };
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

export function geminiFileStillValid(expiresAt: Date | null | undefined): boolean {
  return Boolean(expiresAt && expiresAt.getTime() - EXPIRY_SAFETY_MS > Date.now());
}

export async function prepareDocument(
  drive: drive_v3.Drive,
  file: { id: string; name: string; mimeType: string; size?: string | null }
): Promise<PreparedDocument | null> {
  const { id, name, mimeType } = file;

  if (file.size && Number(file.size) > MAX_BYTES) {
    throw new Error(`Tệp vượt quá ${MAX_BYTES / 1024 / 1024}MB, chưa đọc nội dung được`);
  }

  const asText = (raw: string): PreparedDocument => ({
    mode: "text",
    text: raw.slice(0, MAX_TEXT_CHARS),
    chars: Math.min(raw.length, MAX_TEXT_CHARS),
    truncated: raw.length > MAX_TEXT_CHARS,
  });

  if (isGoogleNative(mimeType)) return asText(await exportText(drive, id, mimeType));
  if (mimeType in OOXML_TO_GOOGLE) return asText(await convertAndExport(drive, id, OOXML_TO_GOOGLE[mimeType]));
  if (isPlain(mimeType)) return asText((await downloadBuffer(drive, id)).toString("utf-8"));

  if (GEMINI_NATIVE.includes(mimeType)) {
    const uploaded = await uploadToGemini(await downloadBuffer(drive, id), mimeType, name);
    return {
      mode: "file",
      fileUri: uploaded.uri,
      fileName: uploaded.name,
      fileMimeType: mimeType,
      expiresAt: uploaded.expiresAt,
    };
  }

  return null;
}
