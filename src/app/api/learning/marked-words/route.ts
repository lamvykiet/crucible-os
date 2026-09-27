import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry, isTransientAiError, aiErrorMessage } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import { todayStart, DAY_MS } from "@/lib/learningDay";
import { CYCLE_DAYS, TOTAL_CYCLES, nextDueAt } from "@/lib/vocabCycle";
import { bookById } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Những từ người học tự đánh dấu khi đọc sách, và vòng ôn của chúng.
 *
 * Khác giáo trình theo ngày ở MỐC ĐẾM: mỗi từ đếm từ ngày bấm "bắt đầu học"
 * cho chính nó, không phải từ ngày mở một bộ nào. Đánh dấu một từ hôm nay thì
 * đúng mười ngày sau nó quay lại.
 *
 * Vì thế có hai trạng thái, không phải một: ĐÁNH DẤU (để đó, chưa đếm) và ĐANG
 * HỌC (đã có mốc, vòng ôn đang chạy). Gộp hai thứ thành một là bắt người học
 * nhận vòng ôn cho mọi từ họ mới chỉ tô vàng trong lúc đọc.
 *
 * Từ nằm chung bảng `DictionaryItem` với từ học qua giáo trình, phân biệt bằng
 * thẻ `marked` và thẻ tên sách. Một ngân hàng từ vựng, không phải hai.
 */

interface Row {
  id: string;
  term: string;
  phonetic: string | null;
  definition: string;
  example: string | null;
  tags: string[];
  learnStartedAt: Date | null;
  reviewCycles: number;
  lastReviewedAt: Date | null;
}

/**
 * Lọc từ đánh dấu theo thứ tiếng.
 *
 * Phần lớn từ có `languageId`, nhưng từ đánh dấu ở những bản trước có thể để
 * trống — lúc đó suy ra thứ tiếng từ THẺ TÊN SÁCH, vì mỗi cuốn sách khai báo mã
 * tiếng của nó. Bỏ hẳn những dòng trống ấy thì người dùng thấy danh sách thiếu
 * mà không hiểu vì sao; nhận bừa tất cả thì từ tiếng Hàn hiện trong mục tiếng
 * Anh. Suy ra từ thẻ là đường duy nhất vừa đủ và không sai.
 */
function matchesLang(row: { tags: string[] }, langCode: string) {
  return row.tags.some((tag) => bookById(tag)?.langCode === langCode);
}

async function loadMarked(userId: string, languageId: string | null) {
  const language = languageId
    ? await prisma.language.findFirst({
        where: { id: languageId, userId },
        select: { id: true, code: true, name: true, nativeName: true },
      })
    : null;

  const select = {
    id: true, term: true, phonetic: true, definition: true, example: true, tags: true,
    learnStartedAt: true, reviewCycles: true, lastReviewedAt: true,
  } as const;

  if (!language) {
    const rows = await prisma.dictionaryItem.findMany({
      where: { userId, tags: { has: "marked" } },
      select,
      orderBy: { createdAt: "asc" },
    });
    return { rows: rows as Row[], langCode: "en", langName: "English" };
  }

  const [own, loose] = await Promise.all([
    prisma.dictionaryItem.findMany({
      where: { userId, tags: { has: "marked" }, languageId: language.id },
      select,
      orderBy: { createdAt: "asc" },
    }),
    prisma.dictionaryItem.findMany({
      where: { userId, tags: { has: "marked" }, languageId: null },
      select,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    rows: [...own, ...loose.filter((r) => matchesLang(r, language.code))] as Row[],
    langCode: language.code,
    // Tên bản ngữ để nhét vào câu lệnh AI: mô hình hiểu "한국어" chắc chắn hơn
    // mã "ko". Lấy từ chính bảng Language chứ không tra bảng ngôn ngữ dịch —
    // bảng đó không có "cmn" hay "yue" và sẽ lặng lẽ trả về tiếng Việt.
    langName: language.nativeName || language.name,
  };
}

/** Nhãn nguồn: thẻ nào là id sách thì hiện tên sách, còn lại giữ nguyên thẻ. */
function sourceLabel(tags: string[]): string | null {
  for (const tag of tags) {
    if (tag === "marked") continue;
    const book = bookById(tag);
    if (book) return book.title;
  }
  const other = tags.find((tg) => tg !== "marked");
  return other ?? null;
}

const shape = (row: Row, now: Date) => {
  const due = nextDueAt(row.learnStartedAt, row.reviewCycles);
  return {
    id: row.id,
    term: row.term,
    phonetic: row.phonetic,
    definition: row.definition,
    example: row.example,
    source: sourceLabel(row.tags),
    learnStartedAt: row.learnStartedAt,
    cyclesDone: row.reviewCycles,
    totalCycles: TOTAL_CYCLES,
    lastReviewedAt: row.lastReviewedAt,
    dueAt: due,
    overdue: due !== null && due.getTime() < now.getTime(),
  };
};

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const languageId = new URL(req.url).searchParams.get("languageId")?.trim() || null;
    const { rows } = await loadMarked(user.id, languageId);

    const now = new Date();
    const tomorrow = new Date(todayStart(now).getTime() + DAY_MS);
    const shaped = rows.map((r) => shape(r, now));

    // Bốn nhóm, và thứ tự này là thứ tự người học cần đọc: việc hôm nay trước,
    // từ chưa vào vòng sau, còn lại là để tham khảo.
    const due = shaped.filter((w) => w.dueAt !== null && w.dueAt <= tomorrow);
    const waiting = shaped.filter((w) => w.learnStartedAt === null);
    const finished = shaped.filter(
      (w) => w.learnStartedAt !== null && w.cyclesDone >= TOTAL_CYCLES
    );
    const upcoming = shaped
      .filter((w) => w.dueAt !== null && w.dueAt > tomorrow)
      .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime());

    return NextResponse.json({
      success: true,
      cycleDays: CYCLE_DAYS,
      totalCycles: TOTAL_CYCLES,
      counts: {
        total: shaped.length,
        waiting: waiting.length,
        learning: shaped.length - waiting.length - finished.length,
        due: due.length,
        finished: finished.length,
      },
      due, waiting, upcoming, finished,
      /** Từ chưa có nghĩa — đánh dấu lúc đọc thì chỉ có mặt chữ. */
      needMeaning: shaped.filter((w) => !w.definition?.trim()).map((w) => w.id),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được danh sách từ";
    console.error("Marked words error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Bắt đầu học: ghi mốc cho từng từ.
 *
 * Mốc là NGÀY BẤM, và cả năm vòng ôn sau này đếm từ đó. Từ đã có mốc thì bỏ
 * qua, không ghi lại — ghi lại là đẩy lùi cả chuỗi hạn của từ đang học dở.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { ids, languageId, all } = await req.json();
    const now = new Date();

    let targets: string[];
    if (all === true) {
      const { rows } = await loadMarked(user.id, String(languageId ?? "") || null);
      targets = rows.filter((r) => r.learnStartedAt === null).map((r) => r.id);
    } else {
      targets = Array.isArray(ids) ? ids.map(String) : [];
    }

    if (targets.length === 0) {
      return NextResponse.json({ success: true, started: 0 });
    }

    const result = await prisma.dictionaryItem.updateMany({
      where: { id: { in: targets }, userId: user.id, learnStartedAt: null },
      data: { learnStartedAt: now, reviewCycles: 0 },
    });

    return NextResponse.json({
      success: true,
      started: result.count,
      firstDueAt: new Date(now.getTime() + CYCLE_DAYS * DAY_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không bắt đầu được";
    console.error("Start marked word error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Xong một vòng ôn của một từ. */
export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await req.json();
    const row = await prisma.dictionaryItem.findFirst({
      where: { id: String(id ?? ""), userId: user.id },
      select: { id: true, learnStartedAt: true, reviewCycles: true },
    });
    if (!row) {
      return NextResponse.json({ success: false, error: "Không tìm thấy từ" }, { status: 404 });
    }

    // Chưa có mốc mà báo ôn xong thì coi lượt này là lượt học đầu tiên: ghi mốc
    // rồi thôi. Cộng vòng khi chưa có mốc sẽ cho ra hạn ôn tính từ null.
    if (!row.learnStartedAt) {
      const now = new Date();
      await prisma.dictionaryItem.update({
        where: { id: row.id },
        data: { learnStartedAt: now, reviewCycles: 0, lastReviewedAt: now },
      });
      return NextResponse.json({
        success: true, cyclesDone: 0,
        nextDueAt: new Date(now.getTime() + CYCLE_DAYS * DAY_MS),
      });
    }

    const cyclesDone = Math.min(TOTAL_CYCLES, row.reviewCycles + 1);
    await prisma.dictionaryItem.update({
      where: { id: row.id },
      data: { reviewCycles: cyclesDone, lastReviewedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      cyclesDone,
      nextDueAt: nextDueAt(row.learnStartedAt, cyclesDone),
      done: cyclesDone >= TOTAL_CYCLES,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được";
    console.error("Review marked word error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const MEANING_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    words: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          term: { type: SchemaType.STRING },
          meaning: { type: SchemaType.STRING },
          example: { type: SchemaType.STRING },
        },
        required: ["term", "meaning", "example"],
      },
    },
  },
  required: ["words"],
};

/** Mỗi lượt điền nghĩa cho nhiều nhất chừng này từ — một lượt gọi AI. */
const FILL_BATCH = 12;

/**
 * Điền nghĩa cho những từ đánh dấu lúc đọc mà chưa có nghĩa.
 *
 * Đánh dấu trong lúc đọc chỉ lưu mặt chữ, vì dừng lại tra từng từ là mất mạch
 * đọc. Nghĩa điền sau, theo lô, để một lượt gọi AI lo được cả chục từ.
 */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { languageId } = await req.json().catch(() => ({}));
    const { rows, langName } = await loadMarked(user.id, String(languageId ?? "") || null);

    const blanks = rows.filter((r) => !r.definition?.trim()).slice(0, FILL_BATCH);
    if (blanks.length === 0) {
      return NextResponse.json({ success: true, filled: 0, remaining: 0 });
    }

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const meaningLang = promptLanguageName(pref?.translationLanguage);

    const model = modelsWithFallback({
      generationConfig: { responseMimeType: "application/json", responseSchema: MEANING_SCHEMA },
      systemInstruction: `Bạn viết nghĩa và một câu ví dụ cho danh sách từ ${langName} CHO SẴN.

Quy tắc:
- Giữ NGUYÊN danh sách từ được đưa, không thêm và không bớt từ nào. "term" chép lại đúng từ đó.
- "meaning" viết bằng ${meaningLang}, ngắn gọn, nghĩa hay dùng nhất trước.
- "example" là một câu ${langName} ngắn, đời thường, có chứa chính từ đó.
- Tự viết hoàn toàn. KHÔNG chép định nghĩa hay câu ví dụ từ từ điển hay giáo trình nào.`,
    });

    const result = await generateWithRetry(
      model,
      `Viết nghĩa và ví dụ cho ${blanks.length} từ sau:\n${blanks.map((b) => b.term).join("\n")}`,
      { timeoutMs: 35_000 }
    );

    const filled = (JSON.parse(result.response.text()) as {
      words?: { term: string; meaning: string; example: string }[];
    }).words ?? [];
    const byTerm = new Map(filled.map((w) => [w.term?.trim().toLowerCase(), w]));

    // Ghép theo TỪ chứ không theo vị trí: AI đôi khi đảo thứ tự hoặc trả thiếu,
    // ghép theo vị trí là gán nhầm nghĩa cho từ khác.
    let count = 0;
    for (const blank of blanks) {
      const got = byTerm.get(blank.term.trim().toLowerCase());
      if (!got?.meaning?.trim()) continue;
      await prisma.dictionaryItem.update({
        where: { id: blank.id },
        data: { definition: got.meaning.trim(), example: got.example?.trim() || blank.example },
      });
      count += 1;
    }

    const remaining = rows.filter((r) => !r.definition?.trim()).length - count;
    return NextResponse.json({ success: true, filled: count, remaining: Math.max(0, remaining) });
  } catch (error) {
    const message = aiErrorMessage(error);
    const transient = isTransientAiError(error);
    if (!transient) console.error("Fill marked meaning error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}
