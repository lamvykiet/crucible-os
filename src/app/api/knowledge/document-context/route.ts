import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { resolveDocumentContext } from "@/lib/documentContext";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Chuẩn bị một tài liệu Drive để khung chat dùng làm ngữ cảnh.
 *
 * Trả về một trong hai dạng:
 *   { mode: "text", text }                  → nội dung đã trích, gửi kèm câu hỏi
 *   { mode: "file", fileUri, fileMimeType }  → tệp nằm sẵn trên Gemini Files API
 *
 * Toàn bộ phần nặng nằm ở `lib/documentContext` để màn hình Studio dùng lại
 * đúng một đường, không tải và trích lại lần nữa.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { fileId } = await req.json();
    if (!fileId) {
      return NextResponse.json({ success: false, error: "Thiếu fileId" }, { status: 400 });
    }

    const result = await resolveDocumentContext(fileId, user.id);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      ready: result.ready,
      cached: result.cached ?? false,
      mode: result.mode ?? null,
      materialId: result.materialId ?? null,
      name: result.name,
      mimeType: result.mimeType,
      text: result.text ?? "",
      chars: result.chars ?? 0,
      truncated: result.truncated ?? false,
      fileUri: result.fileUri ?? null,
      fileMimeType: result.mode === "file" ? result.mimeType : null,
      reason: result.reason ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được tài liệu";
    console.error("document-context error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
