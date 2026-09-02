import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { drive_v3 } from "googleapis";
import { requireUser } from "@/lib/auth";
import { driveClient, knowledgeRoots, getAllowedFile } from "@/lib/driveAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Xem tài liệu ngay trong trình đọc, thay vì tải file về máy.
 *
 * Vì sao cần route riêng: trình xem cũ trỏ `<iframe>` thẳng vào
 * `/api/drive/download`, và route đó trả đúng MIME type thật của file. Trình
 * duyệt không render được `.docx` — gặp content type nó không hiển thị nổi,
 * Chrome chuyển ngay sang tải xuống. Người dùng bấm vào tài liệu vừa tải lên
 * và nhận về... đúng file đó trong thư mục Downloads.
 *
 * Cách chữa: nhờ chính Drive chuyển sang PDF, thứ mọi trình duyệt đều mở được.
 * Đường chuyển đổi (`files.copy` sang định dạng Google rồi `files.export`) là
 * đúng đường mà `src/lib/documentText.ts` đã dùng để trích text cho AI — ở đây
 * chỉ đổi đích export từ `text/plain` sang `application/pdf`.
 *
 * `/api/drive/download` giữ nguyên: tải về vẫn là việc hợp lệ, chỉ là không
 * phải thứ xảy ra khi người dùng bấm để *đọc*.
 */

const GOOGLE_DOC = "application/vnd.google-apps.document";
const GOOGLE_SHEET = "application/vnd.google-apps.spreadsheet";
const GOOGLE_SLIDE = "application/vnd.google-apps.presentation";

/** Định dạng trình duyệt tự dựng được — đẩy thẳng, không đụng vào. */
const BROWSER_NATIVE_EXACT = [
  "application/pdf",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

/** Định dạng nhờ Drive chuyển sang Google rồi export PDF. */
const CONVERTIBLE: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": GOOGLE_DOC,
  "application/msword": GOOGLE_DOC,
  "application/rtf": GOOGLE_DOC,
  "application/vnd.oasis.opendocument.text": GOOGLE_DOC,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": GOOGLE_SHEET,
  "application/vnd.ms-excel": GOOGLE_SHEET,
  "application/vnd.oasis.opendocument.spreadsheet": GOOGLE_SHEET,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": GOOGLE_SLIDE,
  "application/vnd.ms-powerpoint": GOOGLE_SLIDE,
  "application/vnd.oasis.opendocument.presentation": GOOGLE_SLIDE,
};

const isGoogleNative = (m: string) =>
  m === GOOGLE_DOC || m === GOOGLE_SHEET || m === GOOGLE_SLIDE;

const isBrowserNative = (m: string) =>
  BROWSER_NATIVE_EXACT.includes(m) || m.startsWith("text/");

export type PreviewKind = "direct" | "export" | "convert" | "none";

export function previewKind(mimeType: string): PreviewKind {
  if (isBrowserNative(mimeType)) return "direct";
  if (isGoogleNative(mimeType)) return "export";
  if (mimeType in CONVERTIBLE) return "convert";
  return "none";
}

/**
 * Trần chuyển đổi của Drive, đo theo **file nguồn**.
 *
 * Đừng nhầm với trần 10MB của `files.export` — trần đó áp lên bản PDF *xuất
 * ra*, không phải file gốc. Một .docx 12MB toàn chữ vẫn xuất ra PDF 2MB và
 * chuyển đổi ngon lành; chặn nó bằng ngưỡng 10MB trên file nguồn là chặn oan.
 *
 * Ngưỡng dưới đây lấy theo giới hạn chuyển sang Google Docs (~50MB). Trên mức
 * này thì `files.copy` cũng không xong trong 60 giây của Vercel, nên từ chối
 * sớm còn hơn để người dùng ngồi nhìn vòng quay rồi nhận lỗi.
 *
 * Trong khoảng dưới ngưỡng thì **cứ thử**; Drive từ chối thì bắt lỗi và trả lý
 * do thật, xem `NO_PREVIEW` bên dưới.
 */
const CONVERT_SOURCE_LIMIT_BYTES = 50 * 1024 * 1024;

async function exportPdf(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await drive.files.export(
    { fileId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * Chuyển .docx/.xlsx/.pptx sang định dạng Google rồi export PDF.
 *
 * Bản sao luôn bị xoá trong `finally`, kể cả khi export hỏng — nếu không, mỗi
 * lần mở một tài liệu Word lại đẻ một file rác trong Drive của người dùng.
 */
async function convertToPdf(
  drive: drive_v3.Drive,
  fileId: string,
  targetMime: string
): Promise<Buffer> {
  let copyId: string | null = null;
  try {
    const copied = await drive.files.copy({
      fileId,
      requestBody: { name: `__tmp_preview_${fileId}`, mimeType: targetMime },
      fields: "id",
    });
    copyId = copied.data.id ?? null;
    if (!copyId) throw new Error("Drive không tạo được bản sao để chuyển đổi");
    return await exportPdf(drive, copyId);
  } finally {
    if (copyId) {
      await drive.files.delete({ fileId: copyId }).catch((e) => {
        console.error("Không xoá được bản sao tạm khi xem trước:", copyId, e);
      });
    }
  }
}

/** Content-Disposition an toàn cho tên file tiếng Việt (RFC 5987). */
function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("id");
  const metaOnly = searchParams.get("meta") === "1";

  if (!fileId) {
    return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
  }

  const roots = knowledgeRoots();
  if (roots.length === 0) {
    console.error("Drive preview: chưa cấu hình GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID");
    return NextResponse.json(
      { success: false, error: "Chưa cấu hình thư mục Drive" },
      { status: 503 }
    );
  }

  try {
    const drive = driveClient();
    const meta = await getAllowedFile(drive, fileId, roots);
    if (!meta) {
      // 404 chứ không phải 403: đừng xác nhận cho người gọi biết fileId có tồn tại.
      return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });
    }

    const name = meta.name || "document";
    const mimeType = meta.mimeType || "application/octet-stream";
    const kind = previewKind(mimeType);
    const sizeBytes = meta.size ? Number(meta.size) : null;
    const tooBig =
      kind !== "direct" && sizeBytes !== null && sizeBytes > CONVERT_SOURCE_LIMIT_BYTES;
    const sizeText = sizeBytes ? `${(sizeBytes / 1024 / 1024).toFixed(1)}MB` : "";

    // Trình xem hỏi trước để biết nên dựng iframe hay hiện thẻ "không xem trước
    // được". Không có bước này thì cách duy nhất để biết là... để trình duyệt
    // tải file về, tức đúng cái lỗi đang sửa.
    if (metaOnly) {
      return NextResponse.json({
        success: true,
        name,
        mimeType,
        kind: tooBig ? "none" : kind,
        previewable: kind !== "none" && !tooBig,
        sizeBytes,
        reason: tooBig
          ? `Tệp ${sizeText} — quá lớn để Drive chuyển sang PDF (trần khoảng 50MB).`
          : kind === "none"
            ? "Định dạng này không có trình xem trong trình duyệt."
            : null,
      });
    }

    if (kind === "none" || tooBig) {
      return NextResponse.json(
        { success: false, error: "Không xem trước được định dạng này", code: "NO_PREVIEW" },
        { status: 415 }
      );
    }

    if (kind === "direct") {
      const fileRes = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "stream" }
      );
      const headers: Record<string, string> = {
        "Content-Type": mimeType,
        "Content-Disposition": contentDisposition(name),
        "Cache-Control": "private, max-age=300",
      };
      if (meta.size) headers["Content-Length"] = String(meta.size);
      const body = Readable.toWeb(fileRes.data as unknown as Readable) as ReadableStream;
      return new NextResponse(body, { headers });
    }

    let pdf: Buffer;
    try {
      pdf =
        kind === "export"
          ? await exportPdf(drive, fileId)
          : await convertToPdf(drive, fileId, CONVERTIBLE[mimeType]);
    } catch (error) {
      // Hay gặp nhất: bản PDF xuất ra vượt trần 10MB của `files.export`. Không
      // đoán trước được từ kích thước file nguồn, chỉ biết khi Drive trả lời.
      const detail = error instanceof Error ? error.message : "";
      console.error("Drive preview: chuyển đổi thất bại", fileId, mimeType, error);
      return NextResponse.json(
        {
          success: false,
          code: "NO_PREVIEW",
          error: /export|too large|size/i.test(detail)
            ? "Bản PDF chuyển ra vượt trần 10MB của Drive."
            : "Drive không chuyển được tệp này sang PDF.",
        },
        { status: 415 }
      );
    }

    // Tên hiện trên thanh tiêu đề của trình xem PDF — đổi đuôi để không hiện
    // ".docx" trên một thứ đang thật sự là PDF.
    const pdfName = name.replace(/\.[a-z0-9]+$/i, "") + ".pdf";

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(pdfName),
        "Content-Length": String(pdf.byteLength),
        // Chuyển đổi tốn vài giây và tốn hai lượt gọi Drive; đừng làm lại mỗi
        // lần khung bên cạnh render lại.
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không mở được tài liệu";
    console.error("Drive preview error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
