import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback } from "@/lib/gemini";
import { FAST_MODEL, FAST_FALLBACKS } from "@/lib/fastModels";
import { generateWithRetry, aiErrorMessage, isTransientAiError } from "@/lib/aiRetry";
import { bandBrief } from "@/lib/bookBand";
import { syllabusFor } from "@/lib/grammarSyllabus";
import {
  isPathLevel, nextLevel, gradeTest, cooldownHours, TEST_SECTION_SIZE, TEST_MINUTES,
} from "@/lib/learningPath";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Kiểm tra lên cấp — khuôn của aioenglish.com: 12 từ vựng + 12 ngữ pháp + 12
 * đọc hiểu, 40 phút, đạt khi ≥ 29/36 và mỗi phần ≥ 7/12. Trượt thì chờ 24 giờ,
 * rồi 3 ngày, rồi 7 ngày. Đáp án đúng chỉ hiện khi đạt (đề mỗi lượt là đề mới,
 * nhưng đọc đáp án rồi thi lại ngay thì bài kiểm tra mất nghĩa).
 *
 * Đề AI soạn MỘT lần cho mỗi lượt, ba phần gọi song song để vừa 60 giây.
 */

interface Q {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
interface TestContent {
  vocab: Q[];
  grammar: Q[];
  reading: { passages: { title: string; text: string }[]; questions: (Q & { passage: number })[] };
}

const Q_ITEM: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    prompt: { type: SchemaType.STRING },
    options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Đúng 4 phương án" },
    correctIndex: { type: SchemaType.INTEGER, description: "0–3" },
    explanation: { type: SchemaType.STRING, description: "Giải thích ngắn bằng tiếng Việt" },
  },
  required: ["prompt", "options", "correctIndex", "explanation"],
};

const QS_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: { questions: { type: SchemaType.ARRAY, items: Q_ITEM } },
  required: ["questions"],
};

const READING_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    passages: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          text: { type: SchemaType.STRING },
          questions: { type: SchemaType.ARRAY, items: Q_ITEM },
        },
        required: ["title", "text", "questions"],
      },
    },
  },
  required: ["passages"],
};

const cleanQ = (q: Partial<Q>): Q | null => {
  const options = Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [];
  const ci = Number(q.correctIndex);
  if (!q.prompt || options.length !== 4 || !Number.isInteger(ci) || ci < 0 || ci > 3) return null;
  return { prompt: String(q.prompt), options, correctIndex: ci, explanation: String(q.explanation ?? "") };
};

/** Bỏ đáp án trước khi gửi xuống trình duyệt. */
function publicView(c: TestContent) {
  const strip = (q: Q) => ({ prompt: q.prompt, options: q.options });
  return {
    vocab: c.vocab.map(strip),
    grammar: c.grammar.map(strip),
    reading: { passages: c.reading.passages, questions: c.reading.questions.map((q) => ({ ...strip(q), passage: q.passage })) },
  };
}

async function langOf(userId: string, languageId: unknown) {
  if (typeof languageId !== "string") return null;
  return prisma.language.findFirst({ where: { id: languageId, userId }, select: { id: true, code: true } });
}

async function generate(level: string, code: string): Promise<TestContent> {
  const syllabus = syllabusFor(code);
  const points = syllabus?.families.flatMap((f) => f.groups.flatMap((g) => g.points)).filter((p) => p.level === level) ?? [];
  const brief = bandBrief(level);
  const sys = `Bạn ra đề kiểm tra lên cấp ${level} (CEFR) cho người Việt học tiếng Anh. Mỗi câu trắc nghiệm có đúng 4 phương án, chỉ một phương án đúng, phương án nhiễu hợp lý. Đề phải có chỗ trống "____" cần điền hoặc một câu hỏi rõ ràng, và TUYỆT ĐỐI không chép sẵn đáp án đúng vào đề. Không đánh A/B/C/D trước phương án. Giải thích bằng tiếng Việt.\n\n${brief}`;

  const call = (schema: Schema, prompt: string) =>
    generateWithRetry(
      modelsWithFallback({ generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.7 }, systemInstruction: sys }, FAST_MODEL, FAST_FALLBACKS),
      prompt,
      { timeoutMs: 45_000, totalBudgetMs: 52_000 }
    ).then((r) => JSON.parse(r.response.text()));

  const [v, g, r] = await Promise.all([
    call(QS_SCHEMA, `Ra đúng ${TEST_SECTION_SIZE} câu TỪ VỰNG cấp ${level}: chọn từ đúng điền vào câu, nghĩa của từ trong ngữ cảnh, kết hợp từ, dạng từ. Trải đều nhiều chủ đề, không lặp từ.`),
    call(QS_SCHEMA, `Ra đúng ${TEST_SECTION_SIZE} câu NGỮ PHÁP cấp ${level}, mỗi câu kiểm một điểm khác nhau, rút từ danh sách sau:\n${points.map((p) => `- ${p.title}`).join("\n")}`),
    call(READING_SCHEMA, `Viết 2 đoạn đọc hiểu cấp ${level} (mỗi đoạn 150–220 từ, chủ đề khác nhau, đời sống hoặc xã hội), mỗi đoạn kèm đúng ${TEST_SECTION_SIZE / 2} câu hỏi chỉ trả lời được từ chính đoạn văn.`),
  ]);

  const vocab = ((v.questions ?? []) as Partial<Q>[]).map(cleanQ).filter(Boolean).slice(0, TEST_SECTION_SIZE) as Q[];
  const grammar = ((g.questions ?? []) as Partial<Q>[]).map(cleanQ).filter(Boolean).slice(0, TEST_SECTION_SIZE) as Q[];
  const passages = ((r.passages ?? []) as { title?: string; text?: string; questions?: Partial<Q>[] }[]).slice(0, 2);
  const reading = {
    passages: passages.map((p) => ({ title: String(p.title ?? ""), text: String(p.text ?? "") })),
    questions: passages.flatMap((p, pi) =>
      ((p.questions ?? []).map(cleanQ).filter(Boolean) as Q[]).slice(0, TEST_SECTION_SIZE / 2).map((q) => ({ ...q, passage: pi }))
    ),
  };

  if (vocab.length < TEST_SECTION_SIZE || grammar.length < TEST_SECTION_SIZE || reading.questions.length < TEST_SECTION_SIZE) {
    throw new Error("AI ra đề thiếu câu. Thử lại sau ít phút.");
  }
  return { vocab, grammar, reading };
}

/** Mở lại một lượt đang làm dở. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;
  const id = new URL(req.url).searchParams.get("testId") ?? "";
  const test = await prisma.levelTest.findFirst({ where: { id, userId: user.id } });
  if (!test) return NextResponse.json({ success: false, error: "Không có bài này" }, { status: 404 });
  return NextResponse.json({
    success: true,
    test: { id: test.id, level: test.level, startedAt: test.startedAt, submitted: Boolean(test.submittedAt), minutes: TEST_MINUTES, content: publicView(JSON.parse(test.questions)) },
  });
}

/** Bắt đầu một lượt (hoặc trả lượt đang dở). */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const lang = await langOf(user.id, body.languageId);
    if (!lang) return NextResponse.json({ success: false, error: "Không tìm thấy thứ tiếng này" }, { status: 404 });
    const pref = await prisma.learningPath.findUnique({ where: { userId_languageId: { userId: user.id, languageId: lang.id } } });
    const level = pref && isPathLevel(pref.level) ? pref.level : "B1";

    const recent = await prisma.levelTest.findMany({
      where: { userId: user.id, languageId: lang.id },
      orderBy: { startedAt: "desc" },
      take: 10,
    });
    const open = recent.find((t) => !t.submittedAt && t.level === level && Date.now() - t.startedAt.getTime() < 45 * 60_000);
    if (open) {
      return NextResponse.json({
        success: true,
        test: { id: open.id, level, startedAt: open.startedAt, minutes: TEST_MINUTES, content: publicView(JSON.parse(open.questions)) },
      });
    }

    let fails = 0;
    for (const t of recent) {
      if (!t.submittedAt) continue;
      if (t.passed) break;
      fails++;
    }
    const lastFail = recent.find((t) => t.submittedAt && t.passed === false);
    if (fails > 0 && lastFail?.submittedAt) {
      const until = new Date(lastFail.submittedAt.getTime() + cooldownHours(fails) * 3600_000);
      if (until > new Date()) {
        return NextResponse.json(
          { success: false, error: "Chưa tới lúc thi lại.", cooldownUntil: until.toISOString() },
          { status: 429 }
        );
      }
    }

    const content = await generate(level, lang.code);
    const test = await prisma.levelTest.create({
      data: { userId: user.id, languageId: lang.id, langCode: lang.code, level, questions: JSON.stringify(content) },
    });
    return NextResponse.json({
      success: true,
      test: { id: test.id, level, startedAt: test.startedAt, minutes: TEST_MINUTES, content: publicView(content) },
    });
  } catch (error) {
    console.error("Level test start error:", error);
    const transient = isTransientAiError(error);
    return NextResponse.json({ success: false, error: aiErrorMessage(error), transient }, { status: transient ? 503 : 500 });
  }
}

/** Nộp bài: chấm, ghi kết quả, đạt thì lên cấp. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const test = await prisma.levelTest.findFirst({ where: { id: String(body.testId ?? ""), userId: user.id } });
    if (!test) return NextResponse.json({ success: false, error: "Không có bài này" }, { status: 404 });
    if (test.submittedAt) return NextResponse.json({ success: false, error: "Bài này đã nộp" }, { status: 409 });

    const content = JSON.parse(test.questions) as TestContent;
    const all = [...content.vocab, ...content.grammar, ...content.reading.questions];
    const answers: (number | null)[] = Array.isArray(body.answers)
      ? all.map((_, i) => (Number.isInteger(body.answers[i]) ? Number(body.answers[i]) : null))
      : all.map(() => null);
    const right = all.map((q, i) => answers[i] === q.correctIndex);
    const n = TEST_SECTION_SIZE;
    const sections = {
      vocab: right.slice(0, n).filter(Boolean).length,
      grammar: right.slice(n, 2 * n).filter(Boolean).length,
      reading: right.slice(2 * n).filter(Boolean).length,
    };
    const { total, passed } = gradeTest(sections);

    await prisma.levelTest.update({
      where: { id: test.id },
      data: { answers: JSON.stringify(answers), score: total, sections: JSON.stringify(sections), passed, submittedAt: new Date() },
    });

    let newLevel: string | null = null;
    if (passed && isPathLevel(test.level)) {
      const up = nextLevel(test.level);
      const pref = await prisma.learningPath.findUnique({
        where: { userId_languageId: { userId: user.id, languageId: test.languageId } },
      });
      if (up && pref && pref.level === test.level) {
        await prisma.learningPath.update({ where: { id: pref.id }, data: { level: up } });
        newLevel = up;
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        total, sections, passed, newLevel,
        right,
        // Đáp án và lời giải chỉ trả khi đạt.
        review: passed ? all.map((q) => ({ correctIndex: q.correctIndex, explanation: q.explanation })) : null,
      },
    });
  } catch (error) {
    console.error("Level test submit error:", error);
    return NextResponse.json({ success: false, error: "Không chấm được bài" }, { status: 500 });
  }
}
