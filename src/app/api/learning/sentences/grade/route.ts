import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback, GEMINI_GRADING_MODEL } from "@/lib/gemini";
import { generateWithRetry, aiErrorMessage, isTransientAiError } from "@/lib/aiRetry";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Chấm một bản dịch tự do Việt → Anh.
 *
 * Ô chữ lật dần ở màn Dịch câu chỉ so với MỘT đáp án mẫu, mà một câu tiếng Việt
 * dịch đúng được nhiều cách. Nút này để người học hỏi "cách của mình có sai
 * không" khi bản dịch khác bản mẫu — giống phần chấm điểm dịch của AIO English.
 * Tốn một lượt Gemini nên chỉ chạy khi người học bấm.
 */

const GRADE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.INTEGER, description: "0–10" },
    verdict: { type: SchemaType.STRING, format: "enum", enum: ["correct", "close", "wrong"] },
    corrected: { type: SchemaType.STRING, description: "Bản dịch của người học sau khi sửa tối thiểu" },
    summary: { type: SchemaType.STRING, description: "Một câu nhận xét tiếng Việt" },
    issues: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          wrong: { type: SchemaType.STRING },
          right: { type: SchemaType.STRING },
          why: { type: SchemaType.STRING, description: "Giải thích ngắn bằng tiếng Việt" },
        },
        required: ["wrong", "right", "why"],
      },
    },
  },
  required: ["score", "verdict", "corrected", "summary", "issues"],
};

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const vi = String(body.vi ?? "").trim().slice(0, 600);
    const reference = String(body.reference ?? "").trim().slice(0, 600);
    const answer = String(body.answer ?? "").trim().slice(0, 600);
    if (!vi || !answer) {
      return NextResponse.json({ success: false, error: "Chưa có bản dịch để chấm" }, { status: 400 });
    }

    const model = modelsWithFallback(
      {
        generationConfig: { responseMimeType: "application/json", responseSchema: GRADE_SCHEMA, temperature: 0.2 },
        systemInstruction: `Bạn chấm bài dịch Việt → Anh của người Việt đang luyện IELTS.

Chấm Ý NGHĨA và ĐỘ TỰ NHIÊN, không chấm việc giống bản mẫu. Bản mẫu chỉ để tham khảo: cách dịch khác mà đúng nghĩa, đúng ngữ pháp, tự nhiên thì vẫn là "correct".
- correct (8–10): đúng nghĩa, đúng ngữ pháp, người bản xứ sẽ nói vậy.
- close (5–7): hiểu được nhưng có lỗi nhỏ (mạo từ, giới từ, chia động từ, từ hơi lạ).
- wrong (0–4): sai nghĩa, thiếu ý, hoặc lỗi ngữ pháp nặng.
"corrected" là bản của người học sửa ÍT NHẤT có thể để thành đúng — giữ cách diễn đạt của họ, không thay bằng bản mẫu. Đúng rồi thì chép nguyên.
"issues" liệt kê từng lỗi cụ thể; đúng hết thì để mảng rỗng. Giải thích bằng tiếng Việt, ngắn, nói rõ quy tắc.`,
      },
      GEMINI_GRADING_MODEL
    );

    const prompt = `Câu tiếng Việt: ${vi}
${reference ? `Bản mẫu tham khảo: ${reference}\n` : ""}Bản dịch của người học: ${answer}`;

    const result = await generateWithRetry(model, prompt, { timeoutMs: 20_000, totalBudgetMs: 26_000 });
    const g = JSON.parse(result.response.text()) as {
      score?: number; verdict?: string; corrected?: string; summary?: string;
      issues?: { wrong: string; right: string; why: string }[];
    };

    return NextResponse.json({
      success: true,
      grade: {
        score: Math.max(0, Math.min(10, Math.round(Number(g.score) || 0))),
        verdict: g.verdict === "correct" || g.verdict === "close" ? g.verdict : "wrong",
        corrected: String(g.corrected ?? answer),
        summary: String(g.summary ?? ""),
        issues: Array.isArray(g.issues) ? g.issues.slice(0, 8) : [],
      },
    });
  } catch (error) {
    console.error("Translation grade error:", error);
    const transient = isTransientAiError(error);
    return NextResponse.json(
      { success: false, error: aiErrorMessage(error), transient },
      { status: transient ? 503 : 500 }
    );
  }
}
