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
export const maxDuration = 45;

// Mỗi LƯỢT thử 20 giây, cả chuỗi 40 giây.
//
// Đặt mỗi lượt thật dài thì chỉ đủ chỗ cho một model, mà hạn mức gói miễn phí
// tính theo từng model nên phải để dành thời gian cho model kế tiếp. Lượt soạn
// bài chạy được đo được 16 giây; model nào chưa trả lời trong 20 giây thì đang
// chật vật, chuyển sang model khác đáng hơn là ngồi đợi.
const AI_TIMEOUT_MS = 20_000;
const QUESTION_COUNT = 6;

/**
 * Bài luyện tập cho một điểm ngữ pháp.
 *
 * Sinh một lần rồi giữ lại cùng bài học. Sinh lại mỗi lần mở thì vừa tốn lượt
 * gọi AI, vừa làm người học không thể làm lại đúng bộ câu mình vừa sai.
 *
 * Đáp án KHÔNG gửi xuống trình duyệt lúc phát đề — chấm ở máy chủ, giống cách
 * phần thi thử đã làm. Gửi kèm đáp án thì chỉ cần mở tab mạng là thấy hết.
 */

const PRACTICE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          prompt: { type: SchemaType.STRING, description: "Câu hỏi, có chỗ trống hoặc yêu cầu chọn dạng đúng" },
          options: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Đúng 4 phương án",
          },
          correctIndex: { type: SchemaType.NUMBER, description: "Vị trí phương án đúng, tính từ 0" },
          explanation: { type: SchemaType.STRING, description: "Một câu giải thích vì sao đáp án đó đúng" },
        },
        required: ["prompt", "options", "correctIndex", "explanation"],
      },
    },
  },
  required: ["questions"],
};

interface Question {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/** Lấy bộ câu hỏi, sinh mới nếu chưa có. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { pointId, langCode = "en", refresh } = await req.json();
    const found = findPoint(String(langCode), String(pointId ?? ""));
    if (!found) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài này" }, { status: 404 });
    }

    const key = { userId_pointId_langCode: { userId: user.id, pointId: found.point.id, langCode } };
    const existing = await prisma.grammarLesson.findUnique({ where: key });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Hãy mở phần kiến thức trước" },
        { status: 409 }
      );
    }

    if (existing.exercises && !refresh) {
      const questions = safeParse(existing.exercises);
      return NextResponse.json({ success: true, questions: strip(questions), cached: true });
    }

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);
    const targetLanguage = presetByCode(String(langCode))?.nativeName ?? "English";

    const model = modelsWithFallback({
      generationConfig: { responseMimeType: "application/json", responseSchema: PRACTICE_SCHEMA },
      systemInstruction: `Bạn ra ${QUESTION_COUNT} câu trắc nghiệm luyện đúng một điểm ngữ pháp ${targetLanguage}, cho người học trình độ ${found.point.level} theo thang ${found.syllabus.scale}.

Quy tắc:
- "prompt" và "options" viết bằng ${targetLanguage}. "explanation" viết bằng ${explainIn}.
- Mỗi câu đúng 4 phương án, chỉ một phương án đúng.
- Câu hỏi phải kiểm tra CHÍNH điểm ngữ pháp này, không lạc sang điểm khác.
- Phương án sai phải là lỗi người học hay mắc thật, không phải phương án ngớ
  ngẩn khiến đoán mò cũng trúng.
- Từ vựng giữ trong tầm ${found.point.level}: đang kiểm tra ngữ pháp, không phải
  kiểm tra từ vựng.
- Viết mới hoàn toàn, không lấy câu từ sách hay trang web nào.`,
    });

    const result = await generateWithRetry(
      model,
      `Điểm ngữ pháp: ${found.point.title}\nNhóm: ${found.group.title}\nCấp độ: ${found.point.level}`,
      { timeoutMs: AI_TIMEOUT_MS, totalBudgetMs: 40_000 }
    );

    const parsed = JSON.parse(result.response.text()) as { questions?: Question[] };

    // Lọc câu méo: thiếu phương án, hoặc đáp án đúng trỏ ra ngoài mảng.
    const questions = (parsed.questions ?? []).filter(
      (q) =>
        q.prompt?.trim() &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every((o) => o?.trim()) &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < 4
    );

    if (questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "AI không ra được đề cho bài này, thử lại sau" },
        { status: 502 }
      );
    }

    await prisma.grammarLesson.update({
      where: key,
      data: { exercises: JSON.stringify(questions) },
    });

    return NextResponse.json({ success: true, questions: strip(questions), cached: false });
  } catch (error) {
    const message = aiErrorMessage(error);
    const transient = isTransientAiError(error);
    if (!transient) console.error("Grammar practice error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/** Chấm một câu. Đáp án đối chiếu ở máy chủ, không tin con số trình duyệt gửi lên. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { pointId, langCode = "en", index, choice } = await req.json();
    const found = findPoint(String(langCode), String(pointId ?? ""));
    if (!found) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài này" }, { status: 404 });
    }

    const key = { userId_pointId_langCode: { userId: user.id, pointId: found.point.id, langCode } };
    const lesson = await prisma.grammarLesson.findUnique({ where: key });
    if (!lesson?.exercises) {
      return NextResponse.json({ success: false, error: "Chưa có đề" }, { status: 409 });
    }

    const questions = safeParse(lesson.exercises);
    const question = questions[Number(index)];
    if (!question) {
      return NextResponse.json({ success: false, error: "Câu không tồn tại" }, { status: 400 });
    }

    const correct = Number(choice) === question.correctIndex;

    await prisma.grammarLesson.update({
      where: key,
      data: {
        practiceCount: { increment: 1 },
        ...(correct ? { correctCount: { increment: 1 } } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      correct,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không chấm được";
    console.error("Grammar grade error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function safeParse(raw: string): Question[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Question[]) : [];
  } catch {
    return [];
  }
}

/** Bỏ đáp án và giải thích trước khi gửi xuống trình duyệt. */
const strip = (questions: Question[]) =>
  questions.map((q) => ({ prompt: q.prompt, options: q.options }));
