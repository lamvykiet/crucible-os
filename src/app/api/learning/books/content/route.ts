import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback } from "@/lib/gemini";
import { generateWithRetry, isTransientAiError, aiErrorMessage } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import { bookById } from "@/lib/books";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Bài học và bài tập cho một unit trong sách.
 *
 * Khuôn bám theo cách sách này bày một unit — bảng Form, bảng Use/Example, hộp
 * mẹo, hộp cảnh báo, rồi các khối bài tập A, B, C. Đó là KHUÔN SƯ PHẠM, và
 * khuôn thì không ai sở hữu; cái được bảo hộ là câu chữ trong từng ô. Mọi lời
 * giải thích, ví dụ và câu hỏi ở đây do AI soạn mới từ TÊN UNIT, không đọc lại
 * nội dung sách.
 *
 * Sinh một lần rồi LƯU: người học quay lại đọc lại bài cũ, mà bài đổi mỗi lần
 * mở thì không còn là bài của mình. Cũng là cách để phần này dùng được cả khi
 * hết hạn mức AI.
 */

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
  },
  required: ["summary", "sections"],
};

const EX_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    blocks: {
      type: SchemaType.ARRAY,
      description: "3-4 khối bài tập, mỗi khối một dạng",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING, description: "A, B, C, D" },
          kind: {
            type: SchemaType.STRING,
            description: "gapfill | choice | correct | bank | passage",
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
 * Lấy bài học hoặc bài tập của một unit.
 *
 * `peek: true` nghĩa là CHỈ dò bản đã lưu, không sinh mới. Màn unit dùng nó lúc
 * mở ra: có sẵn thì hiện ngay, chưa có thì để người học tự bấm soạn. Tự động
 * sinh lúc mở là đốt hạn mức AI cho unit người ta chỉ lướt qua.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const book = bookById(String(body.bookId ?? ""));
    const stepNo = Number(body.step);
    const part: "lesson" | "exercises" = body.part === "exercises" ? "exercises" : "lesson";
    const peek = body.peek === true;
    const step = book?.steps.find((s) => s.step === stepNo);

    if (!book || !step) {
      return NextResponse.json({ success: false, error: "Không có bước này" }, { status: 404 });
    }

    const key = { userId_bookId_step: { userId: user.id, bookId: book.id, step: step.step } };
    const row = await prisma.bookLesson.findUnique({ where: key });

    const stored = part === "lesson" ? row?.lesson : row?.exercises;
    if (stored) {
      const parsed = JSON.parse(stored);
      return NextResponse.json({
        success: true, part, cached: true,
        ...(part === "lesson" ? { lesson: parsed } : { exercises: parsed }),
      });
    }

    // Chỉ dò thì dừng ở đây, chưa gọi AI.
    if (peek) return NextResponse.json({ success: true, part, cached: false });

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);

    // Với unit từ vựng thì đưa kèm danh sách từ để bài bám đúng chủ đề.
    const wordList = (step.words ?? []).slice(0, 60).map((w) => w.term).join(", ");
    const topic = `${step.kind === "review" ? "Bài ôn" : "Unit"} "${step.title}"${
      wordList ? `\n\nTừ vựng của unit này: ${wordList}` : ""
    }`;

    const isGrammar = step.kind !== "vocabulary";

    const model = modelsWithFallback({
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: part === "lesson" ? LESSON_SCHEMA : EX_SCHEMA,
      },
      systemInstruction:
        part === "lesson"
          ? `Bạn soạn phần LÝ THUYẾT cho một unit của sách ngữ pháp và từ vựng tiếng Anh trình độ ${book.level}.

Khuôn trình bày: mỗi điểm chính một mục. ${
              isGrammar
                ? 'Mỗi mục ngữ pháp cần bảng "form" (cột: statement, negative, question; hàng theo ngôi), danh sách "uses" (dùng để làm gì + câu ví dụ), "hints" (từ hay đi kèm, vị trí trong câu), và "watchOut" (chỗ dễ sai).'
                : 'Với unit từ vựng thì BỎ TRỐNG "form". Chia từ theo nhóm nghĩa, mỗi nhóm một mục, "uses" là cặp từ + câu ví dụ có từ đó.'
            }

Quy tắc:
- Viết giải thích bằng ${explainIn}. Câu ví dụ và bảng form giữ nguyên tiếng Anh.
- Ví dụ phải là câu người ta nói thật, đúng tầm ${book.level}.
- TỰ SOẠN hoàn toàn. Không chép giải thích hay ví dụ từ bất kỳ sách nào.
- Ngắn gọn. Đây là trang tra cứu trước khi làm bài, không phải khảo cứu.`
          : `Bạn ra BÀI TẬP cho một unit của sách ngữ pháp và từ vựng tiếng Anh trình độ ${book.level}.

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

Quy tắc:
- "instruction" viết tiếng Anh, giọng của một cuốn sách bài tập.
- "prompt" viết tiếng Anh, dùng ___ đánh dấu chỗ trống. "explanation" viết bằng ${explainIn}.
- Mọi câu phải kiểm tra CHÍNH nội dung của unit này, không lạc sang điểm khác.
- Phương án sai và lỗi cài vào phải là lỗi người học hay mắc thật, không phải lỗi ngớ ngẩn.
- Câu phải là câu người ta nói hoặc viết thật, đúng tầm ${book.level}.
- TỰ RA ĐỀ HOÀN TOÀN. Không chép câu nào từ bất kỳ sách luyện tập nào.`,
    });

    const result = await generateWithRetry(model, topic, {
      timeoutMs: 40_000,
      totalBudgetMs: 55_000,
    });
    const raw = JSON.parse(result.response.text());
    // Bài tập trả về dạng { blocks }, nhưng giao diện đọc `items` — quy về một
    // tên duy nhất ngay tại đây thay vì để hai tên chạy song song.
    const content = part === "exercises" ? { items: raw.blocks ?? [] } : raw;

    await prisma.bookLesson.upsert({
      where: key,
      create: {
        userId: user.id, bookId: book.id, step: step.step,
        [part]: JSON.stringify(content),
      },
      update: { [part]: JSON.stringify(content) },
    });

    return NextResponse.json({
      success: true, part, cached: false,
      ...(part === "lesson" ? { lesson: content } : { exercises: content }),
    });
  } catch (error) {
    const message = aiErrorMessage(error);
    const transient = isTransientAiError(error);
    if (!transient) console.error("Book lesson error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/** Ghi lại kết quả làm bài của một khối. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { bookId, step, correct, total } = await req.json();
    const book = bookById(String(bookId ?? ""));
    if (!book) return NextResponse.json({ success: false, error: "Không có sách" }, { status: 404 });

    await prisma.bookLesson.upsert({
      where: { userId_bookId_step: { userId: user.id, bookId: book.id, step: Number(step) } },
      create: {
        userId: user.id, bookId: book.id, step: Number(step),
        attempts: Number(total) || 0, correctCount: Number(correct) || 0,
      },
      update: {
        attempts: { increment: Number(total) || 0 },
        correctCount: { increment: Number(correct) || 0 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Book lesson score error:", error);
    return NextResponse.json({ success: false, error: "Không lưu được" }, { status: 500 });
  }
}
