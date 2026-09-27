import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry } from "@/lib/aiRetry";
import { bandBrief, cefrOf } from "@/lib/bookBand";
import { syllabusFor } from "@/lib/grammarSyllabus";
import type { Book, BookStep } from "@/lib/books";

/**
 * Soạn bài học và bài tập cho một unit của sách.
 *
 * Tách khỏi route vì có hai đường gọi tới: mở một unit rồi bấm soạn, và soạn cả
 * cuốn một lượt. Để câu lệnh ở trong route thì đường thứ hai phải chép lại, và
 * hai bản chép sẽ lệch nhau ngay lần sửa đầu tiên.
 *
 * Khuôn trình bày bám theo cách sách luyện tập bày một unit — bảng form, bảng
 * use/example, hộp mẹo, rồi các khối bài tập A, B, C, D. Đó là KHUÔN SƯ PHẠM,
 * và khuôn thì không ai sở hữu; cái được bảo hộ là câu chữ trong từng ô. Mọi
 * lời giải thích, ví dụ và câu hỏi ở đây do AI soạn mới từ TÊN UNIT, không đọc
 * lại nội dung sách.
 */

export type Part = "lesson" | "exercises";

const LESSON_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING, description: "2-3 câu: unit này dạy gì và dùng khi nào" },
    sections: {
      type: SchemaType.ARRAY,
      description: "Mỗi điểm chính một mục, thường 2-4 mục",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          heading: { type: SchemaType.STRING },
          intro: { type: SchemaType.STRING, description: "1-2 câu dẫn, có thể để trống" },
          form: {
            type: SchemaType.OBJECT,
            description: "Bảng cấu tạo. Chỉ có với điểm ngữ pháp; từ vựng thì bỏ trống.",
            properties: {
              headers: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              rows: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              },
            },
          },
          uses: {
            type: SchemaType.ARRAY,
            description: "Cặp: dùng để làm gì + một câu ví dụ",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                use: { type: SchemaType.STRING },
                example: { type: SchemaType.STRING, description: "Câu ví dụ bằng tiếng Anh" },
              },
              required: ["use", "example"],
            },
          },
          hints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Mẹo dùng, từ hay đi kèm" },
          watchOut: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Chỗ dễ sai" },
        },
        required: ["heading"],
      },
    },
    notes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Ghi nhớ nhanh, 3-5 gạch đầu dòng" },
    grammarPoints: {
      type: SchemaType.ARRAY,
      description:
        "CHỈ với unit ngữ pháp: tách unit này thành từng điểm ngữ pháp rời để gộp vào mục Ngữ pháp. Unit từ vựng thì để trống.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING, description: "Tên điểm ngữ pháp, viết bằng tiếng Việt" },
          level: { type: SchemaType.STRING, description: "Cấp trong thang, ví dụ B1" },
          rule: { type: SchemaType.STRING, description: "Quy tắc, 1-2 câu" },
          structures: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                pattern: { type: SchemaType.STRING },
                note: { type: SchemaType.STRING },
              },
              required: ["pattern"],
            },
          },
          examples: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                sentence: { type: SchemaType.STRING },
                note: { type: SchemaType.STRING },
              },
              required: ["sentence"],
            },
          },
          syllabusPointId: {
            type: SchemaType.STRING,
            nullable: true,
            description:
              "Id của điểm có sẵn trong khung mà điểm này TRÙNG nội dung. Không trùng cái nào thì để trống.",
          },
        },
        required: ["title", "level", "rule"],
      },
    },
  },
  required: ["summary", "sections"],
};

const EX_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    blocks: {
      type: SchemaType.ARRAY,
      description: "4-5 khối bài tập, mỗi khối một dạng",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING, description: "A, B, C, D" },
          kind: {
            type: SchemaType.STRING,
            description: "build | gapfill | choice | correct | bank | passage",
          },
          instruction: { type: SchemaType.STRING, description: "Lời dẫn, viết bằng tiếng Anh như trong sách bài tập" },
          bank: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "Chỉ với kind=bank: khung từ cho sẵn",
          },
          passage: {
            type: SchemaType.STRING,
            description: "Chỉ với kind=passage: đoạn văn có đúng số lỗi bằng số câu trong items",
          },
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                prompt: { type: SchemaType.STRING, description: "Câu hỏi, dùng ___ cho chỗ trống" },
                given: { type: SchemaType.STRING, description: "Từ trong ngoặc hoặc phần in đậm cần sửa" },
                options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Chỉ với kind=choice: đúng 2 phương án" },
                answer: { type: SchemaType.STRING },
                explanation: { type: SchemaType.STRING, description: "Vì sao, một câu" },
              },
              required: ["prompt", "answer", "explanation"],
            },
          },
        },
        required: ["label", "kind", "instruction", "items"],
      },
    },
  },
  required: ["blocks"],
};

/**
 * Danh sách điểm ngữ pháp có sẵn để AI đối chiếu, thu hẹp quanh cấp của sách.
 *
 * Đưa cả khung (175 điểm với tiếng Anh) thì câu lệnh phình ra mà phần lớn không
 * liên quan; thu về cấp của sách cộng trừ một bậc là đủ, vì một cuốn B1 không
 * dạy điểm C1. Trả chuỗi rỗng khi thứ tiếng chưa có khung — lúc đó mọi điểm của
 * sách đều là điểm mới.
 */
function syllabusCandidates(langCode: string, level: string): string {
  const syllabus = syllabusFor(langCode);
  if (!syllabus) return "";

  const cefr = cefrOf(level);
  const at = syllabus.levels.indexOf(cefr);
  const window = at < 0 ? null : new Set(syllabus.levels.slice(Math.max(0, at - 1), at + 2));

  const lines: string[] = [];
  for (const family of syllabus.families) {
    for (const g of family.groups) {
      for (const p of g.points) {
        if (window && !window.has(p.level)) continue;
        lines.push(`${p.id} = ${p.title} (${p.level})`);
      }
    }
  }
  return lines.join("\n");
}

/** Câu lệnh hệ thống cho phần lý thuyết. */
function lessonInstruction(book: Book, step: BookStep, explainIn: string) {
  const isGrammar = step.kind !== "vocabulary";
  const candidates = isGrammar ? syllabusCandidates(book.langCode, book.level) : "";

  return `Bạn soạn phần LÝ THUYẾT cho một unit của sách ngữ pháp và từ vựng tiếng Anh trình độ ${book.level}.

Khuôn trình bày: mỗi điểm chính một mục. ${
    isGrammar
      ? 'Mỗi mục ngữ pháp cần bảng "form" (cột: statement, negative, question; hàng theo ngôi), danh sách "uses" (dùng để làm gì + câu ví dụ), "hints" (từ hay đi kèm, vị trí trong câu), và "watchOut" (chỗ dễ sai).'
      : 'Với unit từ vựng thì BỎ TRỐNG "form". Chia từ theo nhóm nghĩa, mỗi nhóm một mục, "uses" là cặp từ + câu ví dụ có từ đó.'
  }

${bandBrief(book.level)}

Quy tắc:
- Viết giải thích bằng ${explainIn}. Câu ví dụ và bảng form giữ nguyên tiếng Anh.
- TỰ SOẠN hoàn toàn. Không chép giải thích hay ví dụ từ bất kỳ sách nào.
- Ngắn gọn. Đây là trang tra cứu trước khi làm bài, không phải khảo cứu.${
    isGrammar
      ? `

Phần "grammarPoints": tách unit này thành từng điểm ngữ pháp rời, để gộp vào mục
Ngữ pháp của ứng dụng. Mỗi điểm cần quy tắc, cấu trúc và 2-3 câu ví dụ.${
          candidates
            ? `\n\nDưới đây là những điểm khung ngữ pháp ĐÃ CÓ. Điểm nào của unit
trùng nội dung với một dòng ở đây thì ghi đúng id đó vào "syllabusPointId" —
ứng dụng sẽ bổ sung vào điểm cũ chứ không tạo trùng. Trùng một phần thôi thì cứ
ghi id, phần thêm sẽ thành phần bổ sung. Không trùng cái nào thì để trống.\n\n${candidates}`
            : ""
        }`
      : ""
  }`;
}

/** Câu lệnh hệ thống cho phần bài tập. */
function exerciseInstruction(book: Book, explainIn: string) {
  return `Bạn ra BÀI TẬP cho một unit của sách ngữ pháp và từ vựng tiếng Anh trình độ ${book.level}.

Ra 4-5 khối, MỖI KHỐI MỘT DẠNG KHÁC NHAU, chọn trong sáu dạng sau. Giữ đúng số
câu ghi kèm — đó là nhịp quen thuộc của dạng bài này:

- build (6 câu): cho gợi ý rời bằng dấu gạch chéo, người học viết thành câu
  hoàn chỉnh. "given" là chuỗi gợi ý, ví dụ "every day / get up / half past seven".
  "answer" là câu hoàn chỉnh. "prompt" để trống chuỗi rỗng.
- gapfill (8 câu): điền chỗ trống, "given" là động từ nguyên thể trong ngoặc cần
  chia. Có vài câu cần dạng phủ định.
- correct (8 câu): câu chứa một chỗ SAI, "given" là đúng cụm sai đó, "answer" là
  cụm đã sửa. Không phải viết lại cả câu, chỉ sửa cụm.
- choice (10 câu): chọn một trong hai, "options" đúng 2 phương án.
- bank (8 câu): điền chỗ trống bằng từ lấy trong "bank"; bank có đúng 8 từ và
  mỗi từ dùng đúng một lần.
- passage (10 câu): viết một đoạn văn 90-130 từ vào trường "passage", trong đó
  có ĐÚNG 10 chỗ dùng sai. Mỗi item: "given" là cụm sai đúng như trong đoạn,
  "answer" là cụm đúng, "prompt" để trống chuỗi rỗng.

${bandBrief(book.level)}

Quy tắc:
- "instruction" viết tiếng Anh, giọng của một cuốn sách bài tập.
- "prompt" viết tiếng Anh, dùng ___ đánh dấu chỗ trống. "explanation" viết bằng ${explainIn}.
- Mọi câu phải kiểm tra CHÍNH nội dung của unit này, không lạc sang điểm khác.
- Phương án sai và lỗi cài vào phải là lỗi người học hay mắc thật, không phải lỗi ngớ ngẩn.
- TỰ RA ĐỀ HOÀN TOÀN. Không chép câu nào từ bất kỳ sách luyện tập nào.`;
}

export interface GrammarPointDraft {
  title: string;
  level: string;
  rule: string;
  structures?: { pattern: string; note?: string }[];
  examples?: { sentence: string; note?: string }[];
  syllabusPointId?: string | null;
}

/**
 * Soạn một phần của một unit. Trả về nội dung đã quy về hình dạng giao diện đọc.
 *
 * `grammarPoints` được bóc khỏi bài học trước khi lưu: nó thuộc mục Ngữ pháp,
 * không phải thứ hiện trên trang bài học, mà để lẫn trong JSON bài học thì lần
 * sau đọc lại sẽ lưu vào mục Ngữ pháp lần thứ hai.
 */
export async function generateStepContent(
  book: Book,
  step: BookStep,
  part: Part,
  explainIn: string
): Promise<{ content: Record<string, unknown>; grammarPoints: GrammarPointDraft[] }> {
  // Với unit từ vựng thì đưa kèm danh sách từ để bài bám đúng chủ đề.
  const wordList = (step.words ?? []).slice(0, 60).map((w) => w.term).join(", ");
  const topic = `${step.kind === "review" ? "Bài ôn" : "Unit"} "${step.title}"${
    wordList ? `\n\nTừ vựng của unit này: ${wordList}` : ""
  }`;

  const model = modelsWithFallback({
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: part === "lesson" ? LESSON_SCHEMA : EX_SCHEMA,
    },
    systemInstruction:
      part === "lesson"
        ? lessonInstruction(book, step, explainIn)
        : exerciseInstruction(book, explainIn),
  });

  const result = await generateWithRetry(model, topic, {
    timeoutMs: 40_000,
    totalBudgetMs: 55_000,
  });
  const raw = JSON.parse(result.response.text()) as Record<string, unknown>;

  if (part === "exercises") {
    // Bài tập trả về dạng { blocks }, nhưng giao diện đọc `items` — quy về một
    // tên duy nhất ngay tại đây thay vì để hai tên chạy song song.
    return { content: { items: raw.blocks ?? [] }, grammarPoints: [] };
  }

  const { grammarPoints, ...lesson } = raw as { grammarPoints?: GrammarPointDraft[] };
  return {
    content: lesson as Record<string, unknown>,
    grammarPoints: Array.isArray(grammarPoints) ? grammarPoints : [],
  };
}

/**
 * Ghi những điểm ngữ pháp rút từ một unit vào mục Ngữ pháp.
 *
 * Khoá theo (sách, bước, tên điểm) nên soạn lại bài học là ghi đè đúng dòng cũ,
 * không đẻ bản trùng. Điểm nào AI nhận ra là trùng khung có sẵn thì mang theo
 * `syllabusPointId` và sẽ hiện như phần BỔ SUNG cho điểm đó; điểm không trùng
 * nằm riêng thành nhánh của sách.
 */
export async function saveGrammarNotes(
  userId: string,
  book: Book,
  step: BookStep,
  points: GrammarPointDraft[]
) {
  const syllabus = syllabusFor(book.langCode);
  const known = new Set<string>();
  if (syllabus) {
    for (const f of syllabus.families) {
      for (const g of f.groups) for (const p of g.points) known.add(p.id);
    }
  }

  for (const point of points) {
    const title = point.title?.trim();
    if (!title || !point.rule?.trim()) continue;

    // Id do AI trả về mà không có trong khung thì bỏ, coi như điểm mới. Giữ lại
    // là tạo ra một điểm bổ sung treo vào chỗ không tồn tại, và nó sẽ không bao
    // giờ hiện ra ở đâu cả.
    const mapped =
      point.syllabusPointId && known.has(point.syllabusPointId) ? point.syllabusPointId : null;

    await prisma.bookGrammarNote.upsert({
      where: {
        userId_bookId_step_title: { userId, bookId: book.id, step: step.step, title },
      },
      create: {
        userId,
        langCode: book.langCode,
        bookId: book.id,
        bookTitle: book.title,
        step: step.step,
        stepLabel: step.label,
        title,
        level: point.level?.trim() || book.level,
        rule: point.rule.trim(),
        structures: JSON.stringify(point.structures ?? []),
        examples: JSON.stringify(point.examples ?? []),
        syllabusPointId: mapped,
      },
      update: {
        level: point.level?.trim() || book.level,
        rule: point.rule.trim(),
        structures: JSON.stringify(point.structures ?? []),
        examples: JSON.stringify(point.examples ?? []),
        syllabusPointId: mapped,
        stepLabel: step.label,
        bookTitle: book.title,
      },
    });
  }
}
