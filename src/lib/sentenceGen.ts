import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry } from "@/lib/aiRetry";
import { bandBrief, cefrOf } from "@/lib/bookBand";
import { parseDeckSentences } from "@/lib/sentenceSources";

/**
 * AI soạn một bộ câu (Gõ câu / Dịch câu) rồi LƯU vào `SentenceDeck`.
 *
 * Hai kiểu gọi: theo chủ đề người dùng gõ (màn Gõ câu/Dịch câu), hoặc theo một
 * điểm ngữ pháp (Lộ trình) — khi đó mọi câu phải dùng đúng cấu trúc đó, trộn
 * khẳng định, phủ định, câu hỏi và một vài tình huống đời thường.
 *
 * Câu hỏng (cụm không ghép ra câu, từ khoá không nằm trong câu) bị loại ở
 * `parseDeckSentences` — màn Gõ câu dựa hẳn vào hai thứ đó.
 */

const PIECE: Schema = {
  type: SchemaType.OBJECT,
  properties: { en: { type: SchemaType.STRING }, vi: { type: SchemaType.STRING } },
  required: ["en", "vi"],
};

const DECK_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: "Tên bộ ngắn bằng tiếng Việt, dưới 60 ký tự" },
    sentences: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          en: { type: SchemaType.STRING, description: "Câu hoàn chỉnh bằng thứ tiếng đang học" },
          vi: { type: SchemaType.STRING, description: "Bản dịch tiếng Việt tự nhiên" },
          chunks: {
            type: SchemaType.ARRAY,
            items: PIECE,
            description: "2–4 cụm liên tiếp, nối lại bằng dấu cách phải ra ĐÚNG nguyên câu en, kể cả dấu câu",
          },
          keys: {
            type: SchemaType.ARRAY,
            items: PIECE,
            description: "1–2 từ hoặc cụm từ đáng học, chép NGUYÊN VĂN từ câu en",
          },
        },
        required: ["en", "vi", "chunks", "keys"],
      },
    },
  },
  required: ["title", "sentences"],
};

const LANG_NAMES: Record<string, string> = {
  en: "tiếng Anh", fr: "tiếng Pháp", de: "tiếng Đức", cmn: "tiếng Trung (Quan Thoại)",
  yue: "tiếng Quảng Đông", ko: "tiếng Hàn",
};

export async function generateSentenceDeck(args: {
  userId: string;
  languageId: string | null;
  code: string;
  topic: string;
  level: string;
  count: number;
  /** Điểm ngữ pháp mà mọi câu phải luyện (Lộ trình). */
  grammar?: { pointId: string; title: string };
}) {
  const level = cefrOf(args.level);
  const langName = LANG_NAMES[args.code] ?? args.code;

  const recent = await prisma.sentenceDeck.findMany({
    where: { userId: args.userId, langCode: args.code },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { sentences: true },
  });
  const avoid = recent.flatMap((d) => parseDeckSentences(d.sentences).map((s) => s.en)).slice(0, 30);

  const focus = args.grammar
    ? `
TRỌNG TÂM NGỮ PHÁP: mọi câu PHẢI dùng "${args.grammar.title}" — đó là thứ người học đang luyện. Trộn khẳng định, phủ định, câu hỏi (ít nhất 2 câu mỗi loại nếu cấu trúc cho phép) và đặt câu vào tình huống đời thường hoặc công việc. Điểm ngữ pháp này được dùng kể cả khi cao hơn khuôn trình độ.`
    : "";

  const model = modelsWithFallback({
    generationConfig: { responseMimeType: "application/json", responseSchema: DECK_SCHEMA, temperature: 0.8 },
    systemInstruction: `Bạn soạn câu luyện dịch Việt → ${langName} và luyện gõ câu cho người Việt.

${bandBrief(level)}
${focus}
Yêu cầu cho từng câu:
- Câu tự nhiên, người bản xứ thật sự nói/viết như vậy, VÀ đúng ngữ pháp chuẩn mực dùng được trong bài thi IELTS — không dùng lối nói lỏng sai chuẩn (vd. "didn't ... yet" thay cho hiện tại hoàn thành, "gonna", bỏ trợ động từ).
- "vi" là bản dịch tiếng Việt tự nhiên, không dịch word-by-word.
- "chunks": cắt câu thành 2–4 cụm theo nhịp ngữ nghĩa. Nối các cụm bằng một dấu cách phải ra ĐÚNG câu "en", giữ nguyên dấu câu. Mỗi cụm kèm nghĩa tiếng Việt.
- "keys": 1–2 từ hoặc cụm từ đáng học nhất trong câu, chép NGUYÊN VĂN (cùng dạng chia) từ câu "en", kèm nghĩa ngắn.
- Các câu phải khác nhau về nội dung, không lặp một khuôn.`,
  });

  const prompt = `Chủ đề: ${args.topic}
Soạn đúng ${args.count} câu.${avoid.length ? `\nĐừng lặp lại các câu đã có:\n${avoid.map((s) => `- ${s}`).join("\n")}` : ""}`;

  const result = await generateWithRetry(model, prompt, { timeoutMs: 45_000, totalBudgetMs: 55_000 });
  const parsed = JSON.parse(result.response.text()) as { title?: string; sentences?: unknown[] };
  const sentences = parseDeckSentences(JSON.stringify(parsed.sentences ?? []));

  if (sentences.length < Math.min(4, args.count)) {
    throw new DeckTooSmallError();
  }

  return prisma.sentenceDeck.create({
    data: {
      userId: args.userId,
      languageId: args.languageId,
      langCode: args.code,
      title: (args.grammar?.title || parsed.title?.trim() || args.topic).slice(0, 80),
      level,
      topic: args.topic.slice(0, 120),
      pointId: args.grammar?.pointId ?? null,
      sentences: JSON.stringify(sentences),
    },
  });
}

export class DeckTooSmallError extends Error {
  constructor() {
    super("AI trả về quá ít câu dùng được. Thử lại hoặc đổi chủ đề.");
  }
}
