import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry, isTransientAiError, aiErrorMessage } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";

export const runtime = "nodejs";
export const maxDuration = 60;

const AI_TIMEOUT_MS = 35_000;
const QUESTION_COUNT = 5;

const SKILLS = ["reading", "listening"] as const;

/**
 * Luyện đọc và luyện nghe.
 *
 * Hai kỹ năng dùng chung một đường vì chúng cùng hình dạng: một đoạn văn bản
 * kèm câu hỏi. Khác nhau ở chỗ *người học có được nhìn văn bản hay không*:
 *
 *   Đọc  → hiện đoạn văn, đọc rồi trả lời
 *   Nghe → giấu lời thoại, phát bằng giọng đọc của trình duyệt
 *
 * Nên bài nghe KHÔNG gửi lời thoại xuống trình duyệt lúc phát đề — gửi rồi thì
 * mở tab mạng ra là đọc được, và bài nghe hoá thành bài đọc. Lời thoại chỉ về
 * sau khi đã trả lời xong, để đối chiếu.
 *
 * Đáp án cũng chấm ở máy chủ, giống phần ngữ pháp và thi thử.
 */

const ITEM_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: "Tiêu đề ngắn" },
    body: {
      type: SchemaType.STRING,
      description: "Đoạn văn hoặc lời thoại, tiếng Anh, 150-250 từ",
    },
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          prompt: { type: SchemaType.STRING },
          options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Đúng 4 phương án" },
          correctIndex: { type: SchemaType.NUMBER },
          explanation: { type: SchemaType.STRING, description: "Vì sao đáp án đó đúng, dẫn ra chỗ trong bài" },
        },
        required: ["prompt", "options", "correctIndex", "explanation"],
      },
    },
  },
  required: ["title", "body", "questions"],
};

interface Question {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Content {
  title: string;
  body: string;
  questions: Question[];
}

const parseContent = (raw: string): Content | null => {
  try {
    return JSON.parse(raw) as Content;
  } catch {
    return null;
  }
};

/** Lấy một bài mới. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { skill, level = "B1", languageId, topic } = await req.json();
    if (!SKILLS.includes(skill)) {
      return NextResponse.json({ success: false, error: "Kỹ năng không hợp lệ" }, { status: 400 });
    }

    // Tránh lặp chủ đề đã gặp gần đây.
    const recent = await prisma.practiceItem.findMany({
      where: { userId: user.id, skill, level },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { topic: true },
    });

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);

    const isListening = skill === "listening";

    const model = modelsWithFallback({
      generationConfig: { responseMimeType: "application/json", responseSchema: ITEM_SCHEMA },
      systemInstruction: `Bạn soạn một bài luyện ${isListening ? "NGHE" : "ĐỌC"} tiếng Anh trình độ ${level} theo thang CEFR.

${
  isListening
    ? `"body" là LỜI THOẠI để máy đọc lên: văn nói tự nhiên, câu không quá dài, có thể là độc thoại hoặc hội thoại hai người (ghi rõ "A:" và "B:"). Tránh số liệu dày đặc vì nghe một lần khó bắt.`
    : `"body" là đoạn văn viết: mạch lạc, có mở và kết, đúng tầm ${level}.`
}

Quy tắc:
- Dài 150–250 từ. Từ vựng và cấu trúc giữ trong tầm ${level}.
- ${QUESTION_COUNT} câu hỏi, mỗi câu 4 phương án, chỉ một đáp án đúng.
- Câu hỏi phải trả lời được TỪ CHÍNH BÀI, không đòi kiến thức ngoài.
- Phương án sai phải là hiểu nhầm hợp lý, không phải phương án ngớ ngẩn.
- "prompt" và "options" viết tiếng Anh; "explanation" viết bằng ${explainIn}.
- Tự soạn, không lấy bài từ sách luyện thi hay trang web nào.`,
    });

    const result = await generateWithRetry(
      model,
      [
        topic ? `Chủ đề: ${topic}` : "Tự chọn một chủ đề đời thường hoặc khoa học phổ thông.",
        recent.length > 0
          ? `Tránh các chủ đề đã dùng: ${recent.map((r) => r.topic).filter(Boolean).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      { timeoutMs: AI_TIMEOUT_MS }
    );

    const parsed = JSON.parse(result.response.text()) as Content;

    const questions = (parsed.questions ?? []).filter(
      (q) =>
        q.prompt?.trim() &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < 4
    );

    if (!parsed.body?.trim() || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không soạn được bài, thử lại sau" },
        { status: 502 }
      );
    }

    const item = await prisma.practiceItem.create({
      data: {
        languageId: languageId ?? null,
        skill,
        level,
        topic: parsed.title ?? null,
        content: JSON.stringify({ ...parsed, questions }),
        userId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        id: item.id,
        skill,
        level,
        title: parsed.title,
        // Bài nghe giấu lời thoại: gửi kèm là biến bài nghe thành bài đọc.
        body: isListening ? null : parsed.body,
        questions: questions.map((q) => ({ prompt: q.prompt, options: q.options })),
      },
    });
  } catch (error) {
    const message = aiErrorMessage(error);
    const transient = isTransientAiError(error);
    if (!transient) console.error("Practice item error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/**
 * Nộp đáp án, chấm ở máy chủ.
 *
 * Trả kèm lời thoại đầy đủ sau khi chấm — lúc này người học đã trả lời xong nên
 * đọc lời thoại không còn là gian lận, mà là cách đối chiếu chỗ mình nghe hụt.
 */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { itemId, answers } = await req.json();

    const item = await prisma.practiceItem.findFirst({
      where: { id: String(itemId ?? ""), userId: user.id },
    });
    if (!item) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài" }, { status: 404 });
    }

    const content = parseContent(item.content);
    if (!content) {
      return NextResponse.json({ success: false, error: "Bài hỏng dữ liệu" }, { status: 500 });
    }

    const picked: number[] = Array.isArray(answers) ? answers.map(Number) : [];
    const results = content.questions.map((q, i) => ({
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      chosen: Number.isInteger(picked[i]) ? picked[i] : null,
      correct: picked[i] === q.correctIndex,
    }));
    const correctCount = results.filter((r) => r.correct).length;

    await prisma.practiceItem.update({
      where: { id: item.id },
      data: {
        attempts: { increment: 1 },
        correctCount: { increment: correctCount },
        lastDoneAt: new Date(),
      },
    });

    // Ghi điểm cho kỹ năng. Hỏng bước này cũng không được làm mất kết quả.
    if (item.languageId) {
      try {
        await prisma.skillProgress.upsert({
          where: {
            userId_languageId_skill: {
              userId: user.id,
              languageId: item.languageId,
              skill: item.skill,
            },
          },
          create: {
            userId: user.id,
            languageId: item.languageId,
            skill: item.skill,
            xp: correctCount * 3,
            lessonsDone: 1,
            lastPracticedAt: new Date(),
          },
          update: {
            xp: { increment: correctCount * 3 },
            lessonsDone: { increment: 1 },
            lastPracticedAt: new Date(),
          },
        });
      } catch (progressError) {
        console.error("Skill progress write failed:", progressError);
      }
    }

    return NextResponse.json({
      success: true,
      correctCount,
      total: content.questions.length,
      results,
      /** Giờ mới trả lời thoại — bài đã làm xong nên không còn là gian lận. */
      body: content.body,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không chấm được";
    console.error("Practice grade error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
