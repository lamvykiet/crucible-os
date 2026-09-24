import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry, isTransientAiError } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import { todayStart, DAY_MS } from "@/lib/learningDay";

export const runtime = "nodejs";
export const maxDuration = 60;

const AI_TIMEOUT_MS = 30_000;

/** Mặc định 30 ngày mỗi cấp, 10 từ một ngày. */
const DEFAULT_DAYS = 30;
const WORDS_PER_DAY = 10;

/** Ôn lại sau mỗi 10 ngày, tổng 5 vòng. */
export const CYCLE_DAYS = 10;
export const TOTAL_CYCLES = 5;

const LEVELS = ["B1", "B2", "C1", "C2"] as const;

/**
 * Mã tiếng của một `Language` do người dùng thêm.
 *
 * Giáo trình phải gắn với đúng thứ tiếng: mở phần từ vựng của tiếng Hàn mà ra
 * giáo trình tiếng Anh thì vô nghĩa. Không truyền thì mặc định tiếng Anh, vì
 * thang B1–C2 vốn là thang châu Âu.
 */
async function resolveLangCode(userId: string, languageId?: string | null) {
  if (!languageId) return "en";
  const language = await prisma.language.findFirst({
    where: { id: languageId, userId },
    select: { code: true },
  });
  return language?.code ?? "en";
}

/**
 * Giáo trình từ vựng theo ngày.
 *
 * Mỗi ngày mười từ mới; mỗi bộ mười từ đó quay lại sau đúng 10 ngày, năm vòng.
 * Đây là lịch CỐ ĐỊNH, khác hẳn FSRS mà phần thẻ ghi nhớ đang dùng — FSRS giãn
 * cách theo mức độ nhớ từng thẻ, còn ở đây ngày nào ôn gì là biết trước. Hai hệ
 * chạy song song, không trộn, vì trộn thì mất đúng cái ưu điểm của cả hai.
 *
 * Từ được sinh theo từng ngày lúc người dùng mở tới, không sinh sẵn 300 từ:
 * một lượt gọi AI cho 300 từ vừa lâu vừa dễ hỏng giữa chừng, và người dùng có
 * thể bỏ ngang ở ngày thứ ba. Danh sách từ đã dùng được gửi kèm để không lặp.
 */

const WORDS_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    words: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          term: { type: SchemaType.STRING, description: "Từ hoặc cụm từ" },
          pos: { type: SchemaType.STRING, description: "Từ loại viết tắt: n, v, adj, adv, phr" },
          phonetic: { type: SchemaType.STRING, nullable: true, description: "Phiên âm IPA" },
          meaning: { type: SchemaType.STRING, description: "Nghĩa, viết bằng thứ tiếng được yêu cầu" },
          example: { type: SchemaType.STRING, description: "Một câu ví dụ tự nhiên bằng tiếng Anh" },
          exampleTranslation: { type: SchemaType.STRING, description: "Bản dịch câu ví dụ" },
        },
        required: ["term", "pos", "meaning", "example", "exampleTranslation"],
      },
    },
  },
  required: ["words"],
};

interface Word {
  term: string;
  pos: string;
  phonetic?: string | null;
  meaning: string;
  example: string;
  exampleTranslation: string;
}

const parseWords = (raw: string): Word[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Word[]) : [];
  } catch {
    return [];
  }
};

/** Ngày tới hạn của vòng ôn kế tiếp. Null nghĩa là đã xong cả năm vòng. */
function nextDue(set: { startedAt: Date | null; cyclesDone: number }): Date | null {
  if (!set.startedAt) return null;
  if (set.cyclesDone >= TOTAL_CYCLES) return null;
  return new Date(set.startedAt.getTime() + (set.cyclesDone + 1) * CYCLE_DAYS * DAY_MS);
}

/** Việc của hôm nay: một bộ mới, cộng mọi bộ đã tới hạn ôn. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const params = new URL(req.url).searchParams;
    const level = params.get("level")?.trim() || "B1";
    const langCode = await resolveLangCode(user.id, params.get("languageId")?.trim());

    const course = await prisma.vocabCourse.findUnique({
      where: { userId_langCode_level: { userId: user.id, langCode, level } },
      include: { sets: { orderBy: { dayIndex: "asc" } } },
    });

    if (!course) {
      return NextResponse.json({
        success: true,
        course: null,
        levels: LEVELS,
      });
    }

    const now = new Date();
    const today = todayStart(now);

    const started = course.sets.filter((s) => s.startedAt !== null);
    const dueReviews = started.filter((s) => {
      const due = nextDue(s);
      return due !== null && due <= new Date(today.getTime() + DAY_MS);
    });

    // Chỉ mở MỘT bộ mới mỗi ngày — đó là điểm của giáo trình theo ngày. Đã học
    // bộ mới hôm nay rồi thì hôm nay không có bộ mới nữa.
    const learnedToday = started.some(
      (s) => s.startedAt !== null && s.startedAt >= today
    );
    const nextNew = learnedToday
      ? null
      : course.sets.find((s) => s.startedAt === null) ?? null;

    const finished = started.filter((s) => s.cyclesDone >= TOTAL_CYCLES).length;

    return NextResponse.json({
      success: true,
      levels: LEVELS,
      course: {
        id: course.id,
        level: course.level,
        totalDays: course.totalDays,
        wordsPerDay: course.wordsPerDay,
        startedCount: started.length,
        finishedCount: finished,
        cycleDays: CYCLE_DAYS,
        totalCycles: TOTAL_CYCLES,
      },
      today: {
        newSet: nextNew
          ? {
              id: nextNew.id,
              dayIndex: nextNew.dayIndex,
              // `words` là chuỗi JSON, nên bộ chưa sinh từ vẫn mang `"[]"` —
              // một chuỗi khác rỗng. `Boolean(nextNew.words)` vì thế luôn true
              // và báo là đã có từ trong khi chưa có. Phải đếm phần tử thật.
              ready: parseWords(nextNew.words).length > 0,
            }
          : null,
        reviews: dueReviews.map((s) => ({
          id: s.id,
          dayIndex: s.dayIndex,
          cycle: s.cyclesDone + 1,
          dueAt: nextDue(s),
        })),
      },
      // Lịch sắp tới, để nhìn trước mà sắp xếp thời gian.
      upcoming: started
        .map((s) => ({ dayIndex: s.dayIndex, cycle: s.cyclesDone + 1, dueAt: nextDue(s) }))
        .filter((x) => x.dueAt !== null && x.dueAt > new Date(today.getTime() + DAY_MS))
        .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())
        .slice(0, 8),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được giáo trình";
    console.error("Vocab course error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Tạo giáo trình cho một cấp. Chưa sinh từ — từ sinh dần theo ngày. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { level = "B1", languageId, days } = await req.json();
    const langCode = await resolveLangCode(user.id, languageId);
    if (!LEVELS.includes(level)) {
      return NextResponse.json({ success: false, error: "Cấp độ không hợp lệ" }, { status: 400 });
    }

    const totalDays = Math.min(90, Math.max(5, Number(days) || DEFAULT_DAYS));

    const existing = await prisma.vocabCourse.findUnique({
      where: { userId_langCode_level: { userId: user.id, langCode, level } },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "Giáo trình cấp này đã có" }, { status: 409 });
    }

    const course = await prisma.vocabCourse.create({
      data: {
        langCode,
        level,
        totalDays,
        wordsPerDay: WORDS_PER_DAY,
        userId: user.id,
        // Tạo sẵn khung ngày, nhưng từ để trống — sinh lúc mở tới.
        sets: {
          create: Array.from({ length: totalDays }, (_, i) => ({
            dayIndex: i + 1,
            words: "[]",
          })),
        },
      },
    });

    return NextResponse.json({ success: true, courseId: course.id, totalDays });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tạo được giáo trình";
    console.error("Create vocab course error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Mở một bộ: sinh từ nếu chưa có, rồi trả về mười từ của ngày đó. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { setId } = await req.json();

    const set = await prisma.vocabSet.findFirst({
      where: { id: String(setId ?? ""), course: { userId: user.id } },
      include: { course: true },
    });
    if (!set) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bộ từ" }, { status: 404 });
    }

    let words = parseWords(set.words);

    if (words.length === 0) {
      // Gửi kèm từ đã dùng để AI không lặp lại trong cùng giáo trình.
      const siblings = await prisma.vocabSet.findMany({
        where: { courseId: set.courseId, id: { not: set.id } },
        select: { words: true },
      });
      const used = siblings.flatMap((s) => parseWords(s.words).map((w) => w.term));

      const pref = await prisma.learnerPref.findUnique({
        where: { userId: user.id },
        select: { translationLanguage: true },
      });
      const meaningLang = promptLanguageName(pref?.translationLanguage);

      const model = modelsWithFallback({
        generationConfig: { responseMimeType: "application/json", responseSchema: WORDS_SCHEMA },
        systemInstruction: `Bạn soạn ${WORDS_PER_DAY} từ tiếng Anh trình độ ${set.course.level} theo thang CEFR, cho người tự học.

Quy tắc:
- Đúng tầm ${set.course.level}. Từ quá dễ thì phí một ngày học; quá khó thì không dùng được.
- Chọn từ thật sự hay gặp trong văn viết và hội thoại ở tầm đó, không phải từ hiếm.
- "meaning" và "exampleTranslation" viết bằng ${meaningLang}. "term", "example" giữ tiếng Anh.
- Câu ví dụ phải là câu người ta nói hoặc viết thật, không phải câu bịa cho đủ chỗ.
- Tự soạn, không chép từ danh sách từ vựng có sẵn nào.`,
      });

      const result = await generateWithRetry(
        model,
        used.length > 0
          ? `Soạn ${WORDS_PER_DAY} từ mới. KHÔNG dùng lại bất kỳ từ nào sau đây:\n${used.join(", ")}`
          : `Soạn ${WORDS_PER_DAY} từ.`,
        { timeoutMs: AI_TIMEOUT_MS }
      );

      const parsed = JSON.parse(result.response.text()) as { words?: Word[] };
      const usedLower = new Set(used.map((u) => u.toLowerCase()));

      words = (parsed.words ?? [])
        .filter((w) => w.term?.trim() && w.meaning?.trim() && !usedLower.has(w.term.trim().toLowerCase()))
        .slice(0, WORDS_PER_DAY);

      if (words.length === 0) {
        return NextResponse.json(
          { success: false, error: "Không soạn được từ cho ngày này, thử lại sau" },
          { status: 502 }
        );
      }

      await prisma.vocabSet.update({
        where: { id: set.id },
        data: { words: JSON.stringify(words) },
      });
    }

    return NextResponse.json({
      success: true,
      set: {
        id: set.id,
        dayIndex: set.dayIndex,
        cyclesDone: set.cyclesDone,
        totalCycles: TOTAL_CYCLES,
        isReview: set.startedAt !== null,
        words,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không mở được bộ từ";
    const transient = isTransientAiError(error);
    if (!transient) console.error("Open vocab set error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/** Đánh dấu đã học xong một bộ hôm nay. */
export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { setId } = await req.json();

    const set = await prisma.vocabSet.findFirst({
      where: { id: String(setId ?? ""), course: { userId: user.id } },
    });
    if (!set) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bộ từ" }, { status: 404 });
    }

    const now = new Date();

    // Lần đầu: ghi mốc bắt đầu, đó là gốc để tính cả năm vòng ôn sau này.
    // Các lần sau: cộng một vòng, tối đa năm.
    const updated = await prisma.vocabSet.update({
      where: { id: set.id },
      data: set.startedAt
        ? {
            cyclesDone: Math.min(TOTAL_CYCLES, set.cyclesDone + 1),
            lastReviewedAt: now,
          }
        : { startedAt: now, lastReviewedAt: now },
    });

    return NextResponse.json({
      success: true,
      cyclesDone: updated.cyclesDone,
      nextDueAt: nextDue(updated),
      done: updated.cyclesDone >= TOTAL_CYCLES,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được";
    console.error("Complete vocab set error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
