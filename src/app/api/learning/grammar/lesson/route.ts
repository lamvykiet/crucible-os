import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry, isTransientAiError, aiErrorMessage } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import { findPoint } from "@/lib/grammarSyllabus";
import { presetByCode } from "@/lib/languagePresets";

export const runtime = "nodejs";
export const maxDuration = 60;

// Mỗi LƯỢT thử 25 giây, cả chuỗi 55 giây — phải VỪA ĐỦ CHO HAI lượt.
//
// Đo ngày 25/09/2026: cùng một model, lượt soạn bài chạy được mất 9, 13, 21
// giây, nhưng có lượt quá 30 giây. Đặt mỗi lượt 30 giây thì một lượt chậm ăn
// hết ngân sách và không còn chỗ thử model khác — đã đo đúng cảnh đó: hỏng ở
// giây thứ 31 mà mới chỉ chạm một model.
//
// 25 × 2 = 50 giây, vẫn nằm trong 55. Thời gian nhảy qua model hết hạn mức
// KHÔNG tính vào ngân sách (mỗi lần nhảy ~0,4 giây).
const AI_TIMEOUT_MS = 25_000;

/**
 * Nội dung một bài ngữ pháp.
 *
 * Sinh lần đầu rồi giữ lại. Mở lại là đọc từ bảng — vừa khỏi chờ, vừa để bài
 * học không đổi chữ mỗi lần xem, thứ khiến người học không thể quay lại đúng
 * câu giải thích mình đã hiểu.
 *
 * Nội dung do AI viết mới hoàn toàn theo khung của dự án, không lấy câu chữ
 * của bất kỳ sách hay trang nào — bản thân quy tắc ngữ pháp là dữ kiện về ngôn
 * ngữ, nhưng cách diễn đạt thì thuộc về người viết ra nó.
 */

const LESSON_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING, description: "2-3 câu giới thiệu điểm ngữ pháp này làm được gì" },
    useWhen: { type: SchemaType.STRING, description: "Một câu ngắn: dùng khi nào" },
    structures: {
      type: SchemaType.ARRAY,
      description: "2-3 công thức",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          pattern: { type: SchemaType.STRING, description: "Công thức ngắn gọn, ví dụ: Subject + Verb" },
          note: { type: SchemaType.STRING, description: "Một câu giải thích công thức đó" },
        },
        required: ["pattern", "note"],
      },
    },
    examples: {
      type: SchemaType.ARRAY,
      description: "4-5 câu ví dụ",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sentence: { type: SchemaType.STRING, description: "Câu ví dụ hoàn chỉnh bằng thứ tiếng đang học" },
          note: { type: SchemaType.STRING, description: "Một câu chỉ ra điểm ngữ pháp nằm ở đâu trong câu" },
        },
        required: ["sentence", "note"],
      },
    },
  },
  required: ["summary", "useWhen", "structures", "examples"],
};

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { pointId, langCode = "en", refresh } = await req.json();
    // Phải tra trong khung của ĐÚNG thứ tiếng: id điểm chỉ duy nhất trong một
    // khung, hai thứ tiếng có thể trùng id.
    const found = findPoint(String(langCode), String(pointId ?? ""));
    if (!found) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài này" }, { status: 404 });
    }

    const key = { userId_pointId_langCode: { userId: user.id, pointId: found.point.id, langCode } };

    if (!refresh) {
      const cached = await prisma.grammarLesson.findUnique({ where: key });
      if (cached) {
        // Đánh dấu đã xem, nhưng chỉ lần đầu — không cần ghi lại mỗi lượt mở.
        if (!cached.viewedAt) {
          await prisma.grammarLesson.update({ where: key, data: { viewedAt: new Date() } });
        }
        return NextResponse.json({ success: true, lesson: shape(cached), cached: true });
      }
    }

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);
    const targetLanguage = presetByCode(String(langCode))?.nativeName ?? "English";

    const model = modelsWithFallback({
      generationConfig: { responseMimeType: "application/json", responseSchema: LESSON_SCHEMA },
      systemInstruction: `Bạn soạn một bài ngữ pháp ${targetLanguage} ngắn cho người tự học ở trình độ ${found.point.level} theo thang ${found.syllabus.scale}.

Quy tắc:
- Mọi phần giải thích viết bằng ${explainIn}. Riêng "pattern" và "sentence" viết bằng ${targetLanguage}.
- Viết bằng lời của chính bạn. Không trích lại câu chữ từ bất kỳ sách giáo khoa
  hay trang web nào.
- Đúng tầm ${found.point.level}: câu ví dụ chỉ dùng từ vựng và cấu trúc mà người
  học ở mức đó đã biết. Một bài A1 không được ví dụ bằng câu C1.
- Ví dụ phải là câu người ta nói thật, không phải câu bịa cho đủ công thức.
- Ngắn gọn. Người học đang muốn hiểu nhanh rồi đi luyện, không đọc khảo cứu.`,
    });

    const result = await generateWithRetry(
      model,
      `Họ: ${found.family.title}\nNhóm: ${found.group.title}\nĐiểm ngữ pháp: ${found.point.title}\nCấp độ: ${found.point.level}`,
      { timeoutMs: AI_TIMEOUT_MS, totalBudgetMs: 55_000 }
    );

    const parsed = JSON.parse(result.response.text()) as {
      summary?: string; useWhen?: string;
      structures?: { pattern: string; note: string }[];
      examples?: { sentence: string; note: string }[];
    };

    if (!parsed.summary?.trim() || !parsed.examples?.length) {
      return NextResponse.json(
        { success: false, error: "AI không soạn được bài này, thử lại sau" },
        { status: 502 }
      );
    }

    const saved = await prisma.grammarLesson.upsert({
      where: key,
      create: {
        pointId: found.point.id,
        langCode,
        summary: parsed.summary.trim(),
        useWhen: parsed.useWhen?.trim() || "",
        structures: JSON.stringify(parsed.structures ?? []),
        examples: JSON.stringify(parsed.examples),
        viewedAt: new Date(),
        userId: user.id,
      },
      update: {
        summary: parsed.summary.trim(),
        useWhen: parsed.useWhen?.trim() || "",
        structures: JSON.stringify(parsed.structures ?? []),
        examples: JSON.stringify(parsed.examples),
      },
    });

    return NextResponse.json({ success: true, lesson: shape(saved), cached: false });
  } catch (error) {
    const message = aiErrorMessage(error);
    const transient = isTransientAiError(error);
    if (!transient) console.error("Grammar lesson error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/** Đưa bản ghi về đúng hình dạng giao diện cần, giải mã sẵn phần JSON. */
function shape(row: {
  pointId: string; summary: string; useWhen: string;
  structures: string; examples: string; exercises: string | null;
  practiceCount: number; correctCount: number;
}) {
  const parse = <T,>(raw: string | null, fallback: T): T => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  return {
    pointId: row.pointId,
    summary: row.summary,
    useWhen: row.useWhen,
    structures: parse<{ pattern: string; note: string }[]>(row.structures, []),
    examples: parse<{ sentence: string; note: string }[]>(row.examples, []),
    hasExercises: Boolean(row.exercises),
    practiceCount: row.practiceCount,
    correctCount: row.correctCount,
  };
}
