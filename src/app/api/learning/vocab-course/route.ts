import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry, isTransientAiError, aiErrorMessage } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import { todayStart, DAY_MS } from "@/lib/learningDay";
import { packById, packsFor, splitIntoDays } from "@/lib/vocabPacks";

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

/**
 * Việc của hôm nay, GỘP CHUNG mọi giáo trình của thứ tiếng này.
 *
 * Người học có thể chạy song song một giáo trình AI theo cấp độ và một giáo
 * trình bám theo sách. Trả riêng từng cái thì họ phải tự nhớ hôm nay còn nợ bộ
 * nào ở đâu. Gộp lại thì "hôm nay học gì" chỉ có một câu trả lời.
 *
 * Quy tắc lặp lại giữ nguyên cho mọi giáo trình: mỗi ngày một bộ mới, mỗi bộ
 * quay lại sau 10 ngày, năm vòng.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const params = new URL(req.url).searchParams;
    const langCode = await resolveLangCode(user.id, params.get("languageId")?.trim());

    const courses = await prisma.vocabCourse.findMany({
      where: { userId: user.id, langCode },
      include: { sets: { orderBy: { dayIndex: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    const now = new Date();
    const today = todayStart(now);
    const tomorrow = new Date(today.getTime() + DAY_MS);

    const shaped = courses.map((course) => {
      const started = course.sets.filter((s) => s.startedAt !== null);

      // Chỉ mở MỘT bộ mới mỗi ngày cho MỖI giáo trình — đó là điểm của giáo
      // trình theo ngày. Học dồn năm bộ một buổi thì mười ngày sau năm bộ đó
      // cùng tới hạn, và buổi ôn hôm ấy thành năm mươi từ.
      const learnedToday = started.some((s) => s.startedAt !== null && s.startedAt >= today);
      const nextNew = learnedToday ? null : course.sets.find((s) => s.startedAt === null) ?? null;

      const dueReviews = started.filter((s) => {
        const due = nextDue(s);
        return due !== null && due <= tomorrow;
      });

      return {
        id: course.id,
        level: course.level,
        source: course.source,
        title: course.title,
        totalDays: course.totalDays,
        wordsPerDay: course.wordsPerDay,
        startedCount: started.length,
        finishedCount: started.filter((s) => s.cyclesDone >= TOTAL_CYCLES).length,
        cycleDays: CYCLE_DAYS,
        totalCycles: TOTAL_CYCLES,
        newSet: nextNew
          ? { id: nextNew.id, dayIndex: nextNew.dayIndex, ready: parseWords(nextNew.words).length > 0 }
          : null,
        reviews: dueReviews.map((s) => ({
          id: s.id, dayIndex: s.dayIndex, cycle: s.cyclesDone + 1, dueAt: nextDue(s),
        })),
        upcoming: started
          .map((s) => ({ dayIndex: s.dayIndex, cycle: s.cyclesDone + 1, dueAt: nextDue(s) }))
          .filter((x) => x.dueAt !== null && x.dueAt > tomorrow)
          .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())
          .slice(0, 5),
      };
    });

    return NextResponse.json({
      success: true,
      levels: LEVELS,
      courses: shaped,
      // Những bộ rút từ giáo trình có sẵn mà người dùng chưa mở.
      packs: packsFor(langCode)
        .filter((pack) => !courses.some((c) => c.source === pack.id))
        .map((pack) => ({
          id: pack.id,
          title: pack.title,
          level: pack.level,
          note: pack.note,
          unitCount: pack.units.length,
          wordCount: splitIntoDays(pack, WORDS_PER_DAY).flat().length,
        })),
      // Tổng việc hôm nay, gộp mọi giáo trình.
      todayTotal: {
        newSets: shaped.filter((c) => c.newSet).length,
        reviews: shaped.reduce((n, c) => n + c.reviews.length, 0),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được giáo trình";
    console.error("Vocab course error:", error);
    return NextResponse.json({ success: false, error: message, courses: [] }, { status: 500 });
  }
}

/** Tạo giáo trình cho một cấp. Chưa sinh từ — từ sinh dần theo ngày. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { level = "B1", languageId, days, packId } = await req.json();
    const langCode = await resolveLangCode(user.id, languageId);

    // ── Giáo trình bám theo một cuốn sách ────────────────────────────────
    // Khác giáo trình AI ở chỗ TỪ ĐÃ CÓ SẴN và theo đúng trình tự chủ đề của
    // sách; chỉ nghĩa và câu ví dụ mới sinh sau, lúc mở tới từng ngày.
    if (packId) {
      const pack = packById(String(packId));
      if (!pack || pack.langCode !== langCode) {
        return NextResponse.json({ success: false, error: "Không có bộ này" }, { status: 400 });
      }

      const dup = await prisma.vocabCourse.findUnique({
        where: {
          userId_langCode_level_source: {
            userId: user.id, langCode, level: pack.level, source: pack.id,
          },
        },
      });
      if (dup) {
        return NextResponse.json({ success: false, error: "Giáo trình này đã có" }, { status: 409 });
      }

      const days = splitIntoDays(pack, WORDS_PER_DAY);
      const course = await prisma.vocabCourse.create({
        data: {
          langCode,
          level: pack.level,
          source: pack.id,
          title: pack.title,
          totalDays: days.length,
          wordsPerDay: WORDS_PER_DAY,
          userId: user.id,
          sets: {
            create: days.map((words, i) => ({
              dayIndex: i + 1,
              // Từ và phiên âm đã có từ sách; nghĩa và ví dụ để trống, sinh lúc
              // mở tới. Sinh sẵn cả nghìn từ vừa lâu vừa phí nếu bỏ ngang.
              words: JSON.stringify(
                words.map((w) => ({
                  term: w.term,
                  pos: "",
                  phonetic: w.ipa,
                  meaning: "",
                  example: "",
                  exampleTranslation: "",
                  unit: w.unit,
                  unitTitle: w.unitTitle,
                }))
              ),
            })),
          },
        },
      });

      return NextResponse.json({ success: true, courseId: course.id, totalDays: days.length });
    }

    if (!LEVELS.includes(level)) {
      return NextResponse.json({ success: false, error: "Cấp độ không hợp lệ" }, { status: 400 });
    }

    const totalDays = Math.min(90, Math.max(5, Number(days) || DEFAULT_DAYS));

    const existing = await prisma.vocabCourse.findUnique({
      where: {
        userId_langCode_level_source: { userId: user.id, langCode, level, source: "ai" },
      },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "Giáo trình cấp này đã có" }, { status: 409 });
    }

    const course = await prisma.vocabCourse.create({
      data: {
        langCode,
        level,
        source: "ai",
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

    // Bộ rút từ sách đã có sẵn từ và phiên âm, chỉ thiếu nghĩa và ví dụ. Lúc đó
    // KHÔNG được bốc từ mới — phải giữ đúng danh sách của sách, chỉ điền phần
    // còn trống. Bốc từ mới là làm hỏng trình tự chủ đề, thứ duy nhất khiến
    // việc bám theo giáo trình có ý nghĩa.
    const needsMeaning = words.length > 0 && words.every((w) => !w.meaning?.trim());

    if (needsMeaning) {
      const pref = await prisma.learnerPref.findUnique({
        where: { userId: user.id },
        select: { translationLanguage: true },
      });
      const meaningLang = promptLanguageName(pref?.translationLanguage);
      const topic = (words[0] as Word & { unitTitle?: string }).unitTitle;

      const model = modelsWithFallback({
        generationConfig: { responseMimeType: "application/json", responseSchema: WORDS_SCHEMA },
        systemInstruction: `Bạn viết nghĩa và câu ví dụ cho một danh sách từ tiếng Anh CHO SẴN.

Quy tắc:
- Giữ NGUYÊN danh sách từ được đưa, đúng thứ tự, không thêm và không bớt từ nào.
- "term" chép lại đúng từ được đưa. "phonetic" giữ nguyên nếu đã có.
- "meaning" và "exampleTranslation" viết bằng ${meaningLang}. "example" viết tiếng Anh.
- Câu ví dụ phải là câu người ta nói hoặc viết thật, ngắn và đời thường, hợp trình độ sơ cấp.
- Tự viết hoàn toàn. KHÔNG chép định nghĩa hay câu ví dụ từ bất kỳ từ điển hay giáo trình nào.${
          topic ? `\n- Các từ này cùng thuộc chủ đề "${topic}", nên chọn ví dụ hợp chủ đề đó.` : ""
        }`,
      });

      const result = await generateWithRetry(
        model,
        `Viết nghĩa và ví dụ cho đúng ${words.length} từ sau, giữ nguyên thứ tự:\n${words
          .map((w) => `${w.term}${w.phonetic ? ` /${w.phonetic}/` : ""}`)
          .join("\n")}`,
        { timeoutMs: AI_TIMEOUT_MS }
      );

      const filled = (JSON.parse(result.response.text()) as { words?: Word[] }).words ?? [];
      const byTerm = new Map(filled.map((w) => [w.term?.trim().toLowerCase(), w]));

      // Ghép theo TỪ chứ không theo vị trí: AI đôi khi đảo thứ tự hoặc trả
      // thiếu, ghép theo vị trí là gán nhầm nghĩa cho từ khác.
      words = words.map((w) => {
        const got = byTerm.get(w.term.trim().toLowerCase());
        return got
          ? {
              ...w,
              pos: got.pos || w.pos,
              phonetic: w.phonetic || got.phonetic,
              meaning: got.meaning ?? "",
              example: got.example ?? "",
              exampleTranslation: got.exampleTranslation ?? "",
            }
          : w;
      });

      if (words.every((w) => !w.meaning?.trim())) {
        return NextResponse.json(
          { success: false, error: "Chưa viết được nghĩa cho ngày này, thử lại sau" },
          { status: 502 }
        );
      }

      await prisma.vocabSet.update({
        where: { id: set.id },
        data: { words: JSON.stringify(words) },
      });
    } else if (words.length === 0) {
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
    const message = aiErrorMessage(error);
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
      include: { course: true },
    });
    if (!set) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bộ từ" }, { status: 404 });
    }

    const now = new Date();

    // Học xong một bộ thì từ vào NGÂN HÀNG TỪ VỰNG, gắn cờ là nguồn của giáo
    // trình. Nhờ cờ đó sau này lọc ra được "những từ đến từ cuốn nào".
    //
    // Chỉ làm ở lần đầu (`startedAt` còn trống): các vòng ôn sau là ôn lại đúng
    // những từ đó, không phải từ mới.
    //
    // Hỏng bước này KHÔNG được làm mất tiến độ học — nên bọc riêng.
    if (!set.startedAt) {
      try {
        const words = parseWords(set.words).filter((w) => w.term?.trim() && w.meaning?.trim());
        if (words.length > 0) {
          const language = set.course.langCode
            ? await prisma.language.findFirst({
                where: { userId: user.id, code: set.course.langCode },
                select: { id: true },
              })
            : null;

          const existing = await prisma.dictionaryItem.findMany({
            where: { userId: user.id, term: { in: words.map((w) => w.term) } },
            select: { term: true },
          });
          const have = new Set(existing.map((e) => e.term.toLowerCase()));

          const fresh = words.filter((w) => !have.has(w.term.trim().toLowerCase()));
          if (fresh.length > 0) {
            await prisma.dictionaryItem.createMany({
              data: fresh.map((w, i) => ({
                userId: user.id,
                languageId: language?.id ?? null,
                term: w.term.trim(),
                definition: w.meaning,
                phonetic: w.phonetic ?? null,
                example: w.example || null,
                exampleTranslation: w.exampleTranslation || null,
                tags: [set.course.source],
                orderIndex: set.dayIndex * 100 + i,
              })),
            });
          }
        }
      } catch (bankError) {
        console.error("Vocab bank write failed:", bankError);
      }
    }

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
