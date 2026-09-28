import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry } from "@/lib/aiRetry";
import { bandBrief, cefrOf } from "@/lib/bookBand";
import { syllabusFor } from "@/lib/grammarSyllabus";
import { bookPointId } from "@/lib/bookGrammar";
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

/**
 * Ngân sách thời gian, khác nhau theo phần.
 *
 * Bài tập cần lâu hơn hẳn bài học vì đầu ra lớn hơn nhiều — bốn năm khối, mỗi
 * khối sáu tới mười câu, mỗi câu kèm đáp án và lời giải. Đo ngày 27/09/2026:
 * unit 2 của Destination B1 vượt 40 giây rồi bị huỷ, trong khi phần bài học của
 * chính unit đó xong trong 20 giây.
 *
 * `totalBudgetMs` chỉ nhỉnh hơn `timeoutMs` một chút với phần bài tập: một lượt
 * 50 giây đã sát trần 60 giây của request, không còn chỗ cho lượt thứ hai, nên
 * đặt ngân sách rộng hơn chỉ tạo ảo giác là còn cơ hội thử lại.
 */
/**
 * `light` là lượt THỬ LẠI cho phần đã hỏng một lần vì chạy quá lâu.
 *
 * Xin 3 khối thay vì 4-5: vẫn là một bộ bài tập đủ dùng, nhưng đầu ra ngắn hơn
 * hẳn nên kịp trong ngân sách. Quan sát ngày 28/09/2026: unit R11, 34 và 35 —
 * toàn unit ngữ pháp, tức nhánh xin nhiều khối nhất — hỏng đi hỏng lại đúng vì
 * độ dài. Bỏ lại cho lần sau thì lần sau cũng thế, vì không có gì đổi.
 */
const DEFAULT_BUDGET: Record<Part, { timeoutMs: number; totalBudgetMs: number }> = {
  lesson: { timeoutMs: 30_000, totalBudgetMs: 55_000 },
  exercises: { timeoutMs: 50_000, totalBudgetMs: 52_000 },
};

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
                given: {
                  type: SchemaType.STRING,
                  description:
                    "Phần cho sẵn kèm câu, tuỳ dạng bài: động từ nguyên thể cần chia, " +
                    "cụm sai cần sửa, chuỗi gợi ý rời, hoặc gợi ý NGHĨA với bài từ vựng. " +
                    "Với bài từ vựng thì không bao giờ là chính từ cần điền.",
                },
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
 * Danh sách điểm ngữ pháp có sẵn để AI đối chiếu.
 *
 * Lấy MỌI cấp từ đáy thang lên tới cấp của sách cộng một bậc. Bản đầu chỉ lấy
 * quanh cấp của sách cộng trừ một bậc, và điều đó đẻ ra bản trùng: một cuốn ôn
 * B1 dạy lại "will", "be going to", "in/on/at" — những điểm khung xếp ở A1 —
 * nên chúng nằm ngoài cửa sổ, AI không thấy, báo "không trùng", và ứng dụng tạo
 * điểm thứ hai y hệt. Sách ôn cấp nào thì ôn lại tất cả những gì dưới cấp đó;
 * cửa sổ phải mở từ đáy.
 *
 * Chặn trên vẫn giữ: một cuốn B1 không dạy điểm C1, đưa vào chỉ tổ mời AI gán
 * bừa lên trên.
 *
 * Trả chuỗi rỗng khi thứ tiếng chưa có khung — lúc đó mọi điểm của sách đều mới.
 */
function syllabusCandidates(langCode: string, level: string): string {
  const syllabus = syllabusFor(langCode);
  if (!syllabus) return "";

  const cefr = cefrOf(level);
  const at = syllabus.levels.indexOf(cefr);
  const window = at < 0 ? null : new Set(syllabus.levels.slice(0, at + 2));

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

/**
 * Câu lệnh hệ thống cho phần bài tập.
 *
 * Unit từ vựng ra ÍT khối hơn và chỉ những dạng hợp với từ vựng. Hai lý do:
 * `correct` và `build` vốn là bài luyện ngữ pháp — bắt người học sửa thì của
 * một unit dạy tên các môn thể thao là lạc đề; và unit từ vựng đã nhồi sẵn cả
 * danh sách từ vào câu lệnh, xin thêm năm khối nữa thì lượt gọi chạy quá lâu
 * rồi bị huỷ. Đo ngày 27/09/2026: unit 3 và unit 6 của Destination B1, cả hai
 * đều là unit từ vựng, đều vượt 50 giây.
 */
function exerciseInstruction(
  book: Book,
  step: BookStep,
  explainIn: string,
  light = false
) {
  const isVocab = step.kind === "vocabulary";

  // Ba dạng cho unit từ vựng, và chúng được ĐỊNH NGHĨA LẠI chứ không mượn định
  // nghĩa của bài ngữ pháp. Dùng lại y nguyên thì "gapfill" vẫn là cho động từ
  // trong ngoặc rồi bảo chia — tức là phát sẵn đáp án và đi hỏi chuyện khác.
  // Đã ra đúng cảnh đó: unit "Fun and games" cho ra câu
  // "My brother likes to ___ (collect) old coins", đáp án "collect".
  const vocabForms = `- gapfill (8 câu): một câu có chỗ trống, người học phải NHỚ RA từ. "given" là
  GỢI Ý NGHĨA ngắn bằng ${explainIn}, tuyệt đối không phải từ cần điền và không
  phải một dạng khác của nó. "answer" là từ trong danh sách của unit.
- choice (10 câu): chọn một trong hai TỪ VỰNG, "options" đúng 2 phương án. Cả
  hai phương án đều hợp ngữ pháp — cái sai là sai NGHĨA, không phải sai dạng.
- bank (8 câu): điền chỗ trống bằng từ lấy trong "bank"; bank có đúng 8 từ lấy
  từ danh sách của unit, mỗi từ dùng đúng một lần.`;

  const grammarForms = `- build (6 câu): cho gợi ý rời bằng dấu gạch chéo, người học viết thành câu
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
  "answer" là cụm đúng, "prompt" để trống chuỗi rỗng.`;

  return `Bạn ra BÀI TẬP cho một unit của sách ngữ pháp và từ vựng tiếng Anh trình độ ${book.level}.

Ra ${
    isVocab
      ? "ĐÚNG 3 khối, mỗi khối một dạng, dùng cả ba dạng"
      : light
        ? "ĐÚNG 3 khối, mỗi khối một dạng, chọn trong sáu dạng"
        : "4-5 khối, MỖI KHỐI MỘT DẠNG KHÁC NHAU, chọn trong sáu dạng"
  } sau. Giữ đúng số
câu ghi kèm — đó là nhịp quen thuộc của dạng bài này:

${isVocab ? vocabForms : grammarForms}

${bandBrief(book.level)}

Quy tắc:
- "instruction" viết tiếng Anh, giọng của một cuốn sách bài tập.
- "prompt" viết tiếng Anh, dùng ___ đánh dấu chỗ trống. "explanation" viết bằng ${explainIn}.
- Mọi câu phải kiểm tra CHÍNH nội dung của unit này, không lạc sang điểm khác.${
    isVocab
      ? `
- Đây là unit TỪ VỰNG. Mỗi câu kiểm tra NGHĨA của một từ trong danh sách được
  đưa, không kiểm tra chia động từ, không kiểm tra thì, không kiểm tra hoà hợp
  chủ ngữ. Mỗi từ chỉ dùng cho một câu trong cả bài.
- Câu phải có đủ ngữ cảnh để suy ra đúng MỘT từ. Câu mà điền từ nào cũng xuôi
  thì không kiểm tra được gì.`
      : ""
  }
- Phương án sai và lỗi cài vào phải là lỗi người học hay mắc thật, không phải lỗi ngớ ngẩn.
- TỰ RA ĐỀ HOÀN TOÀN. Không chép câu nào từ bất kỳ sách luyện tập nào.`;
}

interface ExItem {
  prompt?: string;
  given?: string;
  answer?: string;
}
interface ExBlock {
  kind?: string;
  items?: ExItem[];
}

/**
 * Bỏ những "gợi ý" hoá ra chính là đáp án.
 *
 * Câu lệnh nói rõ gợi ý của bài từ vựng phải là NGHĨA, nhưng model vẫn có lúc
 * chép thẳng từ cần điền vào đó — quan sát được ở unit "Fun and games":
 * "He did not ___ the match. (lose)". Một gợi ý bằng đáp án thì tệ hơn không có
 * gợi ý, vì nó biến bài kiểm tra từ vựng thành bài chép lại. Chặn bằng tay ở
 * đây thay vì tin vào câu lệnh: câu lệnh là lời nhắc, còn đây là điều kiện.
 *
 * Riêng `choice` thì gỡ "given" sạch, không cần so: hai phương án đã nằm trong
 * `options`, nên trường này không có vai gì ở dạng đó — và model đã có lúc nhét
 * thẳng đáp án vào, quan sát được ở unit "Direct and indirect objects".
 *
 * Với `correct` thì "given" ĐÚNG LÀ phải gần đáp án — đó là cụm sai cần sửa —
 * và với `build` nó là chuỗi gợi ý rời. Hai dạng đó không đụng tới.
 */
function stripGivenAnswers(blocks: unknown): ExBlock[] {
  if (!Array.isArray(blocks)) return [];
  const norm = (v: string) => v.trim().toLowerCase().replace(/[.,!?;:]$/, "");

  return (blocks as ExBlock[]).map((block) => {
    if (block?.kind === "choice") {
      return { ...block, items: (block.items ?? []).map((it) => ({ ...it, given: "" })) };
    }
    if (block?.kind !== "gapfill" && block?.kind !== "bank") return block;
    return {
      ...block,
      items: (block.items ?? []).map((item) =>
        item?.given && item?.answer && norm(item.given) === norm(item.answer)
          ? { ...item, given: "" }
          : item
      ),
    };
  });
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
  explainIn: string,
  opts?: { budget?: { timeoutMs: number; totalBudgetMs: number }; light?: boolean }
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
        : exerciseInstruction(book, step, explainIn, opts?.light),
  });

  const result = await generateWithRetry(model, topic, opts?.budget ?? DEFAULT_BUDGET[part]);
  const raw = JSON.parse(result.response.text()) as Record<string, unknown>;

  if (part === "exercises") {
    // Bài tập trả về dạng { blocks }, nhưng giao diện đọc `items` — quy về một
    // tên duy nhất ngay tại đây thay vì để hai tên chạy song song.
    return { content: { items: stripGivenAnswers(raw.blocks) }, grammarPoints: [] };
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
const REMAP_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    matches: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          index: { type: SchemaType.INTEGER, description: "Số thứ tự của điểm trong danh sách được đưa" },
          syllabusPointId: {
            type: SchemaType.STRING,
            nullable: true,
            description: "Id điểm trùng trong khung, hoặc để trống nếu khung thật sự chưa có",
          },
        },
        required: ["index"],
      },
    },
  },
  required: ["matches"],
};

/**
 * Đối chiếu lại những điểm sách đang đứng riêng với khung có sẵn.
 *
 * Cần một đường riêng vì việc đối chiếu xảy ra lúc soạn bài, mà lúc đó có thể
 * đối chiếu hụt — bản đầu của `syllabusCandidates` chỉ đưa các cấp quanh cấp
 * sách, nên những điểm khung xếp ở cấp thấp hơn không bao giờ được nhìn tới và
 * ứng dụng tạo bản trùng. Soạn lại cả cuốn để sửa chuyện đó thì tốn cả trăm
 * lượt gọi; đối chiếu lại chỉ cần MỘT lượt cho cả danh sách, vì nó chỉ so tên.
 *
 * Trả về số điểm đã gộp được vào khung.
 */
export async function remapBookGrammar(userId: string, book: Book) {
  const loose = await prisma.bookGrammarNote.findMany({
    where: { userId, bookId: book.id, syllabusPointId: null },
    select: { id: true, title: true, level: true, step: true },
  });
  if (loose.length === 0) return { checked: 0, merged: 0 };

  const candidates = syllabusCandidates(book.langCode, book.level);
  if (!candidates) return { checked: loose.length, merged: 0 };

  const syllabus = syllabusFor(book.langCode);
  const known = new Set<string>();
  if (syllabus) {
    for (const f of syllabus.families) {
      for (const g of f.groups) for (const p of g.points) known.add(p.id);
    }
  }

  const model = modelsWithFallback({
    generationConfig: { responseMimeType: "application/json", responseSchema: REMAP_SCHEMA },
    systemInstruction: `Bạn đối chiếu từng điểm ngữ pháp với một khung chương trình có sẵn.

Với MỖI điểm được đưa, tìm trong khung dưới đây một dòng nói về CÙNG một nội
dung ngữ pháp và ghi id của dòng đó. Tên gọi khác nhau không quan trọng — cùng
nội dung là trùng. Chỉ để trống khi khung thật sự không có điểm nào nói về nội
dung đó.

Trả lại đúng số điểm được đưa, không thêm không bớt. "index" là số thứ tự ghi
ở đầu mỗi dòng.

KHUNG CÓ SẴN:
${candidates}`,
  });

  const result = await generateWithRetry(
    model,
    `Đối chiếu ${loose.length} điểm sau:\n${loose
      .map((n, i) => `${i + 1}. ${n.title} (${n.level})`)
      .join("\n")}`,
    { timeoutMs: 40_000, totalBudgetMs: 50_000 }
  );

  const matches = (JSON.parse(result.response.text()) as {
    matches?: { index: number; syllabusPointId?: string | null }[];
  }).matches ?? [];

  // Ghép theo SỐ THỨ TỰ, không theo tên. Bản đầu ghép theo tên và hỏng ngay:
  // câu hỏi gửi đi kèm cấp độ sau tên, nên model chép lại cả cấp —
  // "Will để nói về tương lai (B1)" — và bảng tra theo tên trần không khớp dòng
  // nào. Sáu điểm đã đối chiếu đúng bị vứt hết, mà kết quả chỉ nói "gộp 0".
  const byIndex = new Map(matches.map((m) => [Number(m.index), m]));

  let merged = 0;
  for (const [i, note] of loose.entries()) {
    const got = byIndex.get(i + 1);
    const id = got?.syllabusPointId;
    if (!id || !known.has(id)) continue;

    await prisma.bookGrammarNote.update({
      where: { id: note.id },
      data: { syllabusPointId: id },
    });
    // Điểm vừa gộp vào khung thì id kiểu "book:..." của nó biến mất khỏi cây,
    // nên bài học treo vào id đó thành mồ côi. Xoá luôn, đừng để lại rác mà
    // không màn nào đọc tới.
    await prisma.grammarLesson.deleteMany({
      where: { userId, pointId: bookPointId(book.id, note.step, note.title) },
    });
    merged += 1;
  }

  return { checked: loose.length, merged };
}

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
