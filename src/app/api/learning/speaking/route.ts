import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback, GEMINI_GRADING_MODEL } from "@/lib/gemini";
import { generateWithRetry, isTransientAiError } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import {
  SPEAKING_CRITERIA, speakingPart, overallSpeakingBand, roundBand,
} from "@/lib/ieltsFormat";

export const runtime = "nodejs";
export const maxDuration = 120;

const AI_TIMEOUT_MS = 60_000;

/**
 * Luyện nói: nhận đoạn thu âm, gỡ băng và chấm bốn tiêu chí.
 *
 * Quyết định then chốt: gửi CHÍNH ĐOẠN ÂM lên AI, không gỡ băng trước rồi chấm
 * bản chữ. Chấm bản chữ thì tiêu chí phát âm thành ra đoán — bản gỡ băng đã mất
 * hết âm, trọng âm và ngữ điệu, mà phát âm là một trong bốn tiêu chí. Gửi âm
 * thanh thì cả bốn tiêu chí đều có căn cứ, và bản gỡ băng là sản phẩm phụ.
 *
 * Âm thanh tới đây phải là WAV — Gemini không nhận `audio/webm` mà
 * `MediaRecorder` sinh ra. Việc đổi định dạng làm ở trình duyệt, xem
 * `src/lib/audioWav.ts`.
 *
 * Band do AI chấm là ước lượng để tự luyện, không phải điểm giám khảo; giao
 * diện nói rõ điều đó.
 */

const PROMPT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    topic: { type: SchemaType.STRING, description: "Chủ đề ngắn, vài chữ" },
    prompt: {
      type: SchemaType.STRING,
      description:
        "Đề nói hoàn chỉnh bằng tiếng Anh. Part 2 phải theo dạng thẻ đề: một câu dẫn rồi các gạch đầu dòng 'You should say:'.",
    },
  },
  required: ["topic", "prompt"],
};

const GRADE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    transcript: {
      type: SchemaType.STRING,
      description:
        "Gỡ băng nguyên văn điều người nói đã nói, kể cả chỗ ngập ngừng và nói sai. KHÔNG sửa lỗi trong bản gỡ băng.",
    },
    audible: {
      type: SchemaType.BOOLEAN,
      description: "false nếu đoạn thu trống, quá nhiễu, hoặc không có tiếng nói nào nghe được",
    },
    fluency: { type: SchemaType.NUMBER, description: "0-9, cho phép nửa điểm" },
    lexis: { type: SchemaType.NUMBER, description: "0-9, cho phép nửa điểm" },
    grammar: { type: SchemaType.NUMBER, description: "0-9, cho phép nửa điểm" },
    pronunciation: { type: SchemaType.NUMBER, description: "0-9, cho phép nửa điểm" },
    summary: { type: SchemaType.STRING, description: "3-4 câu: mạnh ở đâu, yếu ở đâu, nên sửa gì trước" },
    feedback: {
      type: SchemaType.ARRAY,
      description: "4-7 chỗ cụ thể đáng sửa, trích đúng lời đã nói",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          quote: { type: SchemaType.STRING, description: "Trích nguyên văn lời người nói" },
          issue: { type: SchemaType.STRING, description: "Vấn đề gì: ngữ pháp, chọn từ, trọng âm, hay ngập ngừng" },
          better: { type: SchemaType.STRING, description: "Cách nói tự nhiên hơn" },
        },
        required: ["quote", "issue", "better"],
      },
    },
  },
  required: ["transcript", "audible", "fluency", "lexis", "grammar", "pronunciation", "summary", "feedback"],
};

interface Feedback {
  quote: string;
  issue: string;
  better: string;
}

/** Lấy một đề nói. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { part = "part1" } = await req.json();
    const spec = speakingPart(String(part));

    // Tránh lặp chủ đề vừa gặp.
    const recent = await prisma.speakingAttempt.findMany({
      where: { userId: user.id, part: spec.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { prompt: true },
    });

    const model = modelsWithFallback({
      generationConfig: { responseMimeType: "application/json", responseSchema: PROMPT_SCHEMA },
      systemInstruction: `Bạn soạn đề cho phần Nói của một bài thi tiếng Anh, theo đúng dạng ${spec.en}.

Yêu cầu của phần này: ${spec.briefEn}
Thí sinh sẽ nói khoảng ${spec.seconds} giây.

Quy tắc:
- Viết đề bằng tiếng Anh.
- ${
        spec.id === "part1"
          ? "Đưa 3 câu hỏi ngắn quanh một chủ đề đời thường, đánh số. Câu hỏi về chính người nói."
          : spec.id === "part2"
            ? `Theo dạng thẻ đề: mở bằng "Describe …", rồi "You should say:" và 3-4 gạch đầu dòng, rồi kết bằng một câu "and explain …".`
            : "Đưa 3 câu hỏi trừu tượng, đánh số, khó dần, đòi nêu quan điểm và cân nhắc hai phía."
      }
- Mỗi câu hỏi hoặc mỗi gạch đầu dòng nằm trên MỘT DÒNG RIÊNG, ngăn bằng ký tự xuống dòng. Dồn hết vào một đoạn thì người học phải dò mắt tìm câu tiếp theo trong lúc đang tính giờ.
- Đề tự soạn, không lấy từ sách luyện thi hay trang web nào.`,
    });

    const result = await generateWithRetry(
      model,
      recent.length > 0
        ? `Tránh các đề đã dùng gần đây:\n${recent.map((r) => `- ${r.prompt.slice(0, 120)}`).join("\n")}`
        : "Tự chọn một chủ đề.",
      { timeoutMs: 30_000 }
    );

    const parsed = JSON.parse(result.response.text()) as { topic: string; prompt: string };
    if (!parsed.prompt?.trim()) {
      return NextResponse.json({ success: false, error: "Không soạn được đề" }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      part: spec.id,
      topic: parsed.topic,
      prompt: parsed.prompt.trim(),
      seconds: spec.seconds,
      prepSeconds: spec.prepSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không soạn được đề";
    const transient = isTransientAiError(error);
    if (!transient) console.error("Speaking prompt error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/** Nộp đoạn thu: gỡ băng và chấm. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { part = "part1", prompt, languageId, audio, mimeType, seconds } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ success: false, error: "Thiếu đề bài" }, { status: 400 });
    }
    if (typeof audio !== "string" || audio.length < 1000) {
      return NextResponse.json(
        { success: false, error: "Đoạn thu quá ngắn hoặc trống" },
        { status: 400 }
      );
    }
    // Chặn ở đây thay vì để Gemini trả 400 sau một phút chờ.
    if (audio.length > 14_000_000) {
      return NextResponse.json(
        { success: false, error: "Đoạn thu quá dài, hãy nói ngắn hơn" },
        { status: 413 }
      );
    }

    const spec = speakingPart(String(part));
    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);

    const model = modelsWithFallback(
      {
        generationConfig: { responseMimeType: "application/json", responseSchema: GRADE_SCHEMA },
        systemInstruction: `Bạn nghe một bài nói tiếng Anh và chấm theo bốn tiêu chí của phần Nói, thang 0-9, cho phép nửa điểm.

Đây là ${spec.en}: ${spec.briefEn}

Bốn tiêu chí:
${SPEAKING_CRITERIA.map((c) => `- ${c.en}: ${c.whatEn}`).join("\n")}

Cách chấm:
- Nghe đoạn âm rồi gỡ băng NGUYÊN VĂN vào "transcript" — giữ cả chỗ ngập ngừng, lặp lại và nói sai. Đừng sửa gì trong bản gỡ băng; những lỗi đó chính là căn cứ để chấm.
- Chấm "pronunciation" dựa trên âm thật nghe được: từng âm, trọng âm từ, nhịp lên xuống. Đây là lý do bài được gửi dưới dạng âm thanh chứ không phải chữ.
- Bài nói lạc đề thì "fluency" phải phản ánh điều đó, đừng cho điểm cao vì nói trôi chảy về chuyện khác.
- Nói quá ngắn so với ${spec.seconds} giây thì trừ, và nói rõ trong "summary".
- Đoạn thu trống hoặc không nghe được tiếng nói nào thì đặt "audible" là false, điểm để 0, và giải thích trong "summary".
- "summary", "issue" và "better" viết bằng ${explainIn}. "quote" và "transcript" giữ nguyên tiếng Anh như đã nói.
- Chấm thẳng thắn. Cho điểm cao hơn thực tế là làm người học tưởng mình đã tới, rồi vào phòng thi mới biết.`,
      },
      GEMINI_GRADING_MODEL
    );

    const result = await generateWithRetry(
      model,
      [
        { text: `Đề bài:\n${String(prompt).slice(0, 2000)}\n\nBài nói (${Math.round(Number(seconds) || 0)} giây):` },
        { inlineData: { mimeType: typeof mimeType === "string" ? mimeType : "audio/wav", data: audio } },
      ],
      { timeoutMs: AI_TIMEOUT_MS, totalBudgetMs: 100_000 }
    );

    const graded = JSON.parse(result.response.text()) as {
      transcript: string;
      audible: boolean;
      fluency: number;
      lexis: number;
      grammar: number;
      pronunciation: number;
      summary: string;
      feedback: Feedback[];
    };

    if (graded.audible === false) {
      return NextResponse.json({
        success: false,
        error:
          graded.summary?.trim() ||
          "Không nghe được tiếng nói trong đoạn thu. Kiểm tra micro rồi thu lại.",
      });
    }

    const criteria = {
      fluency: roundBand(Number(graded.fluency)),
      lexis: roundBand(Number(graded.lexis)),
      grammar: roundBand(Number(graded.grammar)),
      pronunciation: roundBand(Number(graded.pronunciation)),
    };
    const band = overallSpeakingBand(criteria);

    // Chỉ trích dẫn khớp bản gỡ băng mới giữ. AI đôi khi "trích" một câu nó tự
    // viết lại cho gọn, và người học soi lại bản gỡ băng không thấy câu đó ở đâu.
    const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    const transcriptPlain = plain(graded.transcript ?? "");
    const feedback = (graded.feedback ?? []).filter(
      (f) => f.quote?.trim() && f.better?.trim() && transcriptPlain.includes(plain(f.quote))
    );

    const attempt = await prisma.speakingAttempt.create({
      data: {
        languageId: languageId ?? null,
        part: spec.id,
        prompt: String(prompt),
        transcript: graded.transcript ?? "",
        seconds: Math.round(Number(seconds) || 0),
        band,
        criteria: JSON.stringify(criteria),
        feedback: JSON.stringify(feedback),
        summary: graded.summary ?? null,
        userId: user.id,
      },
    });

    // Ghi điểm kỹ năng. Hỏng bước này cũng không được làm mất kết quả chấm.
    if (languageId) {
      try {
        await prisma.skillProgress.upsert({
          where: { userId_languageId_skill: { userId: user.id, languageId, skill: "speaking" } },
          create: {
            userId: user.id, languageId, skill: "speaking",
            xp: Math.round((band ?? 0) * 5), lessonsDone: 1, lastPracticedAt: new Date(),
          },
          update: {
            xp: { increment: Math.round((band ?? 0) * 5) },
            lessonsDone: { increment: 1 },
            lastPracticedAt: new Date(),
          },
        });
      } catch (progressError) {
        console.error("Skill progress write failed:", progressError);
      }
    }

    return NextResponse.json({
      success: true,
      attempt: {
        id: attempt.id,
        transcript: attempt.transcript,
        seconds: attempt.seconds,
        band,
        criteria,
        feedback,
        summary: attempt.summary,
        /** Số chỗ AI "trích" mà không có trong bản gỡ băng, đã bị bỏ. */
        droppedQuotes: (graded.feedback ?? []).length - feedback.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không chấm được bài nói";
    const transient = isTransientAiError(error);
    if (!transient) console.error("Speaking grade error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/** Các lần nói trước, để nhìn band đi lên hay đứng. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = new URL(req.url).searchParams;
  const languageId = params.get("languageId")?.trim();

  const attempts = await prisma.speakingAttempt.findMany({
    where: { userId: user.id, ...(languageId ? { languageId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, part: true, prompt: true, band: true, seconds: true, createdAt: true },
  });

  return NextResponse.json({ success: true, attempts });
}
