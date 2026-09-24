import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback, GEMINI_GRADING_MODEL } from "@/lib/gemini";
import { generateWithRetry, isTransientAiError, aiErrorMessage } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import { WRITING_TASKS, WRITING_CRITERIA, roundBand } from "@/lib/ieltsFormat";

export const runtime = "nodejs";
export const maxDuration = 60;

const AI_TIMEOUT_MS = 40_000;
const MAX_RESPONSE_CHARS = 12_000;

/**
 * Luyện viết theo định dạng IELTS.
 *
 * Về phạm vi: cấu trúc đề và tên bốn tiêu chí chấm là thông tin công khai về
 * cách kỳ thi vận hành. Đề ở đây do AI sinh mới — dự án không chép đề thi thật,
 * và bảng mô tả band trong prompt là cách diễn đạt của chính dự án (xem
 * `src/lib/ieltsFormat.ts`).
 *
 * Band do AI chấm là ước lượng để tự luyện. Nó hữu ích để thấy mình đang ở
 * quãng nào và sai ở đâu, nhưng không phải điểm giám khảo, và giao diện nói rõ
 * điều đó.
 */

const TASK_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    prompt: { type: SchemaType.STRING, description: "Đề bài hoàn chỉnh bằng tiếng Anh" },
    promptData: {
      type: SchemaType.STRING,
      nullable: true,
      description:
        "Chỉ cho Task 1: mô tả số liệu bằng chữ để thí sinh viết dựa vào (ví dụ bảng số theo năm). Task 2 để trống.",
    },
  },
  required: ["prompt"],
};

const GRADE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    taskResponse: { type: SchemaType.NUMBER, description: "0-9, cho phép nửa điểm" },
    coherence: { type: SchemaType.NUMBER, description: "0-9, cho phép nửa điểm" },
    lexis: { type: SchemaType.NUMBER, description: "0-9, cho phép nửa điểm" },
    grammar: { type: SchemaType.NUMBER, description: "0-9, cho phép nửa điểm" },
    summary: { type: SchemaType.STRING, description: "3-4 câu: mạnh ở đâu, yếu ở đâu, nên sửa gì trước" },
    feedback: {
      type: SchemaType.ARRAY,
      description: "5-8 lỗi cụ thể, trích đúng chữ trong bài",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          quote: { type: SchemaType.STRING, description: "Trích nguyên văn đoạn có lỗi, chép đúng từ bài làm" },
          issue: { type: SchemaType.STRING, description: "Lỗi gì, giải thích ngắn" },
          better: { type: SchemaType.STRING, description: "Viết lại cho đúng" },
        },
        required: ["quote", "issue", "better"],
      },
    },
  },
  required: ["taskResponse", "coherence", "lexis", "grammar", "summary", "feedback"],
};

/** Lịch sử bài đã nộp. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id")?.trim();

    if (id) {
      const one = await prisma.writingSubmission.findFirst({
        where: { id, userId: user.id },
      });
      if (!one) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });
      return NextResponse.json({ success: true, submission: shape(one) });
    }

    const submissions = await prisma.writingSubmission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ success: true, submissions: submissions.map(shape) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được lịch sử";
    console.error("Writing history error:", error);
    return NextResponse.json({ success: false, error: message, submissions: [] }, { status: 500 });
  }
}

/** Sinh một đề mới. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { taskType = "task2" } = await req.json();
    const spec = WRITING_TASKS.find((x) => x.id === taskType);
    if (!spec) {
      return NextResponse.json({ success: false, error: "Loại bài không hợp lệ" }, { status: 400 });
    }

    // Tránh ra lại chủ đề vừa làm — luyện mãi một đề thì không còn là luyện.
    const recent = await prisma.writingSubmission.findMany({
      where: { userId: user.id, taskType },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { prompt: true },
    });

    const model = modelsWithFallback({
      generationConfig: { responseMimeType: "application/json", responseSchema: TASK_SCHEMA },
      systemInstruction: `Bạn ra đề luyện viết theo đúng định dạng ${spec.en} của bài thi IELTS Academic.

${spec.briefEn}

Quy tắc:
- Đề viết bằng tiếng Anh, đúng giọng văn đề thi: ngắn, trung lập, không gợi ý sẵn câu trả lời.
- Tự nghĩ đề mới. Không chép đề từ sách luyện thi hay ngân hàng đề có sẵn.
${
  spec.id === "task1"
    ? `- "promptData" mô tả số liệu bằng CHỮ để thí sinh viết dựa vào, vì giao diện không vẽ biểu đồ. Ví dụ: liệt kê các năm kèm con số cho từng nhóm. Số phải nhất quán và có xu hướng rõ để có cái mà mô tả.`
    : `- "promptData" để trống.`
}`,
    });

    const result = await generateWithRetry(
      model,
      recent.length > 0
        ? `Ra một đề mới, KHÁC hẳn các đề sau:\n${recent.map((r) => `- ${r.prompt}`).join("\n")}`
        : "Ra một đề.",
      { timeoutMs: AI_TIMEOUT_MS }
    );

    const parsed = JSON.parse(result.response.text()) as { prompt?: string; promptData?: string | null };
    if (!parsed.prompt?.trim()) {
      return NextResponse.json({ success: false, error: "Không ra được đề" }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      task: {
        taskType: spec.id,
        prompt: parsed.prompt.trim(),
        promptData: parsed.promptData?.trim() || null,
        minWords: spec.minWords,
        minMinutes: spec.minMinutes,
      },
    });
  } catch (error) {
    const message = aiErrorMessage(error);
    const transient = isTransientAiError(error);
    if (!transient) console.error("Writing task error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/** Nộp bài và chấm. */
export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const taskType = String(body.taskType ?? "task2");
    const spec = WRITING_TASKS.find((x) => x.id === taskType);
    const prompt = String(body.prompt ?? "").trim();
    const text = String(body.response ?? "").trim();

    if (!spec) {
      return NextResponse.json({ success: false, error: "Loại bài không hợp lệ" }, { status: 400 });
    }
    if (!prompt || !text) {
      return NextResponse.json({ success: false, error: "Thiếu đề hoặc bài làm" }, { status: 400 });
    }
    if (text.length > MAX_RESPONSE_CHARS) {
      return NextResponse.json({ success: false, error: "Bài làm quá dài" }, { status: 400 });
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);

    const criteriaBrief = WRITING_CRITERIA.map((c) => `- ${c.en}: ${c.whatEn}`).join("\n");

    // Model chấm tách riêng: chấm bài cần suy luận sâu hơn soạn thẻ từ vựng.
    const model = modelsWithFallback(
      {
        generationConfig: { responseMimeType: "application/json", responseSchema: GRADE_SCHEMA },
        systemInstruction: `Bạn là người chấm bài viết luyện thi IELTS Academic, chấm ${spec.en}.

Chấm bốn tiêu chí, mỗi tiêu chí thang 0–9 và được dùng nửa điểm:
${criteriaBrief}

Quy tắc:
- Chấm đúng thực lực. Cho điểm rộng tay là làm hại người học: họ sẽ đi thi với
  kỳ vọng sai. Nhưng cũng đừng khắt khe quá mức so với tiêu chí.
- Bài dưới ${spec.minWords} từ bị trừ ở tiêu chí đáp ứng yêu cầu đề — đó là quy định của định dạng này.
- "quote" phải TRÍCH NGUYÊN VĂN từ bài làm, không được viết lại hay tóm tắt,
  vì giao diện dùng nó để tô sáng đúng chỗ trong bài.
- Ưu tiên những lỗi lặp đi lặp lại và lỗi cản trở việc hiểu, hơn là lỗi vặt.
- "issue", "better" và "summary" viết bằng ${explainIn}. Phần trích và phần viết lại giữ tiếng Anh.`,
      },
      GEMINI_GRADING_MODEL
    );

    const result = await generateWithRetry(
      model,
      `Đề:\n${prompt}\n${body.promptData ? `\nSố liệu kèm theo:\n${body.promptData}\n` : ""}
Số từ: ${wordCount} (yêu cầu tối thiểu ${spec.minWords})

Bài làm:
${text}`,
      { timeoutMs: AI_TIMEOUT_MS, totalBudgetMs: 50_000 }
    );

    const g = JSON.parse(result.response.text()) as {
      taskResponse: number; coherence: number; lexis: number; grammar: number;
      summary: string; feedback: { quote: string; issue: string; better: string }[];
    };

    const criteria = {
      taskResponse: roundBand(g.taskResponse),
      coherence: roundBand(g.coherence),
      lexis: roundBand(g.lexis),
      grammar: roundBand(g.grammar),
    };
    // Band của một bài là trung bình bốn tiêu chí, làm tròn về nửa điểm.
    const band = roundBand(
      (criteria.taskResponse + criteria.coherence + criteria.lexis + criteria.grammar) / 4
    );

    const saved = await prisma.writingSubmission.create({
      data: {
        languageId: body.languageId ?? null,
        taskType: spec.id,
        prompt,
        promptData: body.promptData ?? null,
        response: text,
        wordCount,
        minutesSpent: body.minutesSpent ? Number(body.minutesSpent) : null,
        band,
        criteria: JSON.stringify(criteria),
        feedback: JSON.stringify(g.feedback ?? []),
        summary: g.summary ?? null,
        gradedAt: new Date(),
        userId: user.id,
      },
    });

    // Ghi điểm cho kỹ năng viết. Hỏng bước này cũng không được làm mất bài đã chấm.
    if (body.languageId) {
      try {
        await prisma.skillProgress.upsert({
          where: {
            userId_languageId_skill: {
              userId: user.id,
              languageId: String(body.languageId),
              skill: "writing",
            },
          },
          create: {
            userId: user.id,
            languageId: String(body.languageId),
            skill: "writing",
            xp: 20,
            lessonsDone: 1,
            minutes: Number(body.minutesSpent) || 0,
            lastPracticedAt: new Date(),
          },
          update: {
            xp: { increment: 20 },
            lessonsDone: { increment: 1 },
            minutes: { increment: Number(body.minutesSpent) || 0 },
            lastPracticedAt: new Date(),
          },
        });
      } catch (progressError) {
        console.error("Skill progress write failed:", progressError);
      }
    }

    return NextResponse.json({ success: true, submission: shape(saved) });
  } catch (error) {
    const message = aiErrorMessage(error);
    const transient = isTransientAiError(error);
    if (!transient) console.error("Writing grade error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

function shape(row: {
  id: string; taskType: string; prompt: string; promptData: string | null;
  response: string; wordCount: number; minutesSpent: number | null;
  band: number | null; criteria: string | null; feedback: string | null;
  summary: string | null; createdAt: Date;
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
    id: row.id,
    taskType: row.taskType,
    prompt: row.prompt,
    promptData: row.promptData,
    response: row.response,
    wordCount: row.wordCount,
    minutesSpent: row.minutesSpent,
    band: row.band,
    criteria: parse<Record<string, number>>(row.criteria, {}),
    feedback: parse<{ quote: string; issue: string; better: string }[]>(row.feedback, []),
    summary: row.summary,
    createdAt: row.createdAt,
  };
}
