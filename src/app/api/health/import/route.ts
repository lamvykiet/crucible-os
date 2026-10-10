import { NextRequest, NextResponse } from "next/server";
import { GEMINI_VISION_MODEL, modelsWithFallback } from "@/lib/gemini";
import { aiErrorMessage, generateWithRetry } from "@/lib/aiRetry";
import { requireUser } from "@/lib/auth";
import {
  BODY_PROMPT, BODY_SCHEMA, IMPORT_MAX_BYTES, IMPORT_MAX_FILES, IMPORT_MIME, WORKOUT_PROMPT, WORKOUT_SCHEMA,
} from "@/lib/healthImport";
import { findExercise } from "@/lib/exercises";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Đọc phiếu đo cơ thể (`kind=body`) hoặc ảnh chụp buổi tập (`kind=workout`).
 *
 * KHÔNG ghi gì xuống DB — trả về số đọc được để client mở form điền sẵn cho
 * người dùng soát rồi mới lưu. AI đọc nhầm một chữ số là cả đường xu hướng
 * lệch, nên bước soát là bắt buộc chứ không phải tuỳ chọn.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const form = await req.formData();
    const kind = form.get("kind") === "workout" ? "workout" : "body";
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: "Chưa chọn tệp nào" }, { status: 400 });
    if (files.length > IMPORT_MAX_FILES) {
      return NextResponse.json({ error: `Tối đa ${IMPORT_MAX_FILES} tệp một lần` }, { status: 400 });
    }
    for (const f of files) {
      if (f.size > IMPORT_MAX_BYTES) {
        return NextResponse.json({ error: `"${f.name}" vượt quá ${IMPORT_MAX_BYTES / 1024 / 1024}MB` }, { status: 413 });
      }
      if (f.type && !IMPORT_MIME.includes(f.type)) {
        return NextResponse.json({ error: `Định dạng không hỗ trợ: ${f.type}` }, { status: 415 });
      }
    }

    const parts = await Promise.all(
      files.map(async (f) => ({
        inlineData: { data: Buffer.from(await f.arrayBuffer()).toString("base64"), mimeType: f.type || "application/pdf" },
      }))
    );

    const models = modelsWithFallback(
      {
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: kind === "workout" ? WORKOUT_SCHEMA : BODY_SCHEMA,
        },
      },
      GEMINI_VISION_MODEL
    );
    const result = await generateWithRetry(models, [kind === "workout" ? WORKOUT_PROMPT : BODY_PROMPT, ...parts], {
      timeoutMs: 25_000,
      totalBudgetMs: 50_000,
    });
    const data = JSON.parse(result.response.text());

    // Nhóm cơ không lấy từ AI: tra danh mục theo tên. Bài lạ để trống cho
    // người dùng tự chọn, còn hơn để AI đoán rồi đếm sai số hiệp mỗi nhóm cơ.
    if (kind === "workout" && Array.isArray(data.exercises)) {
      for (const ex of data.exercises) {
        const hit = findExercise(String(ex.name ?? ""));
        ex.muscleGroup = hit?.muscle ?? null;
        if (hit) ex.name = hit.name;
      }
    }

    return NextResponse.json({ kind, data, fileName: files.map((f) => f.name).join(", ") });
  } catch (error) {
    console.error("POST /api/health/import", error);
    return NextResponse.json(
      { error: aiErrorMessage(error), detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
