import { prisma } from "@/lib/prisma";
import { staticSetsFor, findStaticSet, validateSentence, type Sentence } from "@/lib/sentences";

/**
 * Gom câu từ ba nguồn về một khuôn cho hai màn Gõ câu và Dịch câu.
 *
 * - Bộ viết sẵn trong code: id dạng "en.b1.travel".
 * - Bộ AI tạo (`SentenceDeck`): id "ai:<uuid>".
 * - Câu ví dụ trên thẻ và trong giáo trình 30 ngày của chính người dùng: một
 *   bộ ảo id "mine". Câu ở đây không có cụm và từ khoá, nên ở màn Gõ câu chỉ có
 *   bậc "cả câu".
 *
 * Mỗi câu trả ra kèm `ref` = (setId, index) để ghi tiến độ. Với bộ "mine", ref
 * trỏ về nguồn thật ("card:<id>", "vset:<id>") chứ không theo vị trí trong bộ
 * ảo — thêm một thẻ mới không được làm lệch tiến độ của mọi câu sau nó.
 */

export interface SentenceRef {
  setId: string;
  index: number;
}

export interface SourcedSentence extends Sentence {
  ref: SentenceRef;
}

export interface SetSummary {
  id: string;
  title: string;
  level: string;
  topic: string;
  note: string;
  source: "builtin" | "ai" | "mine";
  refs: SentenceRef[];
  createdAt?: string;
}

export const MINE_SET_ID = "mine";

export async function resolveLang(userId: string, languageId?: string | null) {
  if (!languageId) return { code: "en", id: null as string | null };
  const language = await prisma.language.findFirst({
    where: { id: languageId, userId },
    select: { id: true, code: true },
  });
  return { code: language?.code ?? "en", id: language?.id ?? null };
}

/** Đọc mảng câu của một bộ AI, bỏ câu hỏng thay vì làm hỏng cả bộ. */
export function parseDeckSentences(raw: string): Sentence[] {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .map((s: Partial<Sentence>) => ({
        en: String(s.en ?? "").trim(),
        vi: String(s.vi ?? "").trim(),
        chunks: Array.isArray(s.chunks) ? s.chunks : [],
        keys: Array.isArray(s.keys) ? s.keys : [],
      }))
      .filter((s) => validateSentence(s).length === 0);
  } catch {
    return [];
  }
}

/** Câu ví dụ của chính người dùng (thẻ + giáo trình 30 ngày). */
export async function mineSentences(userId: string, languageId: string | null, code: string): Promise<SourcedSentence[]> {
  const out: SourcedSentence[] = [];
  const seen = new Set<string>();
  const push = (en: string, vi: string, ref: SentenceRef) => {
    const key = en.trim().toLowerCase();
    if (!en.trim() || !vi.trim() || seen.has(key)) return;
    seen.add(key);
    out.push({ en: en.trim(), vi: vi.trim(), chunks: [], keys: [], ref });
  };

  if (languageId) {
    const cards = await prisma.dictionaryItem.findMany({
      where: { userId, languageId, example: { not: null }, exampleTranslation: { not: null } },
      select: { id: true, example: true, exampleTranslation: true },
      orderBy: { createdAt: "asc" },
    });
    for (const c of cards) push(c.example ?? "", c.exampleTranslation ?? "", { setId: `card:${c.id}`, index: 0 });
  }

  const sets = await prisma.vocabSet.findMany({
    where: { course: { userId, langCode: code }, startedAt: { not: null } },
    select: { id: true, words: true },
    orderBy: [{ courseId: "asc" }, { dayIndex: "asc" }],
  });
  for (const set of sets) {
    try {
      const words = JSON.parse(set.words) as { example?: string; exampleTranslation?: string }[];
      words.forEach((w, i) => push(w.example ?? "", w.exampleTranslation ?? "", { setId: `vset:${set.id}`, index: i }));
    } catch {
      // Bộ hỏng JSON thì bỏ qua bộ đó, không làm hỏng danh sách.
    }
  }
  return out;
}

/** Danh sách mọi bộ câu của một thứ tiếng (chưa kèm câu). */
export async function listSets(userId: string, languageId: string | null, code: string): Promise<SetSummary[]> {
  const builtin: SetSummary[] = staticSetsFor(code).map((s) => ({
    id: s.id, title: s.title, level: s.level, topic: s.topic, note: s.note, source: "builtin",
    refs: s.sentences.map((_, index) => ({ setId: s.id, index })),
  }));

  const decks = await prisma.sentenceDeck.findMany({
    where: { userId, langCode: code },
    orderBy: { createdAt: "desc" },
  });
  const ai: SetSummary[] = decks.map((d) => {
    const id = `ai:${d.id}`;
    const n = parseDeckSentences(d.sentences).length;
    return {
      id, title: d.title, level: d.level, topic: d.topic, note: `AI soạn theo chủ đề “${d.topic}”.`,
      source: "ai", refs: Array.from({ length: n }, (_, index) => ({ setId: id, index })),
      createdAt: d.createdAt.toISOString(),
    };
  });

  const mine = await mineSentences(userId, languageId, code);
  const own: SetSummary[] = mine.length
    ? [{
        id: MINE_SET_ID, title: "Câu ví dụ trên thẻ của tôi", level: "—", topic: "Của tôi",
        note: "Câu ví dụ từ thẻ từ vựng và giáo trình 30 ngày bạn đã mở.",
        source: "mine", refs: mine.map((s) => s.ref),
      }]
    : [];

  return [...own, ...ai, ...builtin];
}

/** Mở một bộ: trả đủ câu. Null nếu không có hoặc không thuộc người dùng. */
export async function openSet(userId: string, languageId: string | null, code: string, setId: string) {
  if (setId === MINE_SET_ID) {
    const sentences = await mineSentences(userId, languageId, code);
    return sentences.length
      ? { id: setId, title: "Câu ví dụ trên thẻ của tôi", level: "—", source: "mine" as const, sentences }
      : null;
  }

  if (setId.startsWith("ai:")) {
    const deck = await prisma.sentenceDeck.findFirst({ where: { id: setId.slice(3), userId } });
    if (!deck) return null;
    const sentences = parseDeckSentences(deck.sentences).map((s, index) => ({ ...s, ref: { setId, index } }));
    return { id: setId, title: deck.title, level: deck.level, source: "ai" as const, sentences };
  }

  const set = findStaticSet(code, setId);
  if (!set) return null;
  return {
    id: set.id, title: set.title, level: set.level, source: "builtin" as const,
    sentences: set.sentences.map((s, index) => ({ ...s, ref: { setId: set.id, index } })),
  };
}
