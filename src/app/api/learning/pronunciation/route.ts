import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback, GEMINI_GRADING_MODEL } from "@/lib/gemini";
import { generateWithRetry, isTransientAiError } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import { presetByCode } from "@/lib/languagePresets";
import { targetsFor, targetById } from "@/lib/pronunciationTargets";

export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Luyện phát âm, nhắm vào MỘT chỗ khó mỗi lượt.
 *
 * Khác phần Nói ở mục đích: phần Nói chấm cả lượt nói theo bốn tiêu chí, còn ở
 * đây chỉ hỏi một câu — âm này bạn có phát ra đúng không. Nên bài luyện xoay
 * quanh một âm, và phản hồi trả về ngay sau từng câu chứ không dồn tới cuối:
 * biết mình vừa đọc sai ngay lúc vừa đọc thì mới sửa được, còn nhận một bảng
 * điểm sau mười câu thì không biết chỗ nào là chỗ nào.
 *
 * Chỗ khó lấy từ danh sách viết tay `src/lib/pronunciationTargets.ts` chứ không
 * để AI tự nghĩ ra, để luyện được theo thứ tự và tiến độ mới có nghĩa.
 */

const DRILL_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    items: {
      type: SchemaType.ARRAY,
      description: "6 từ hoặc cụm ngắn, rồi 2 câu trọn vẹn — tổng 8, theo đúng thứ tự đó",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          text: { type: SchemaType.STRING, description: "Chữ để đọc, viết theo chính tả chuẩn" },
          phonetic: { type: SchemaType.STRING, description: "Phiên âm theo hệ được yêu cầu" },
          watchFor: {
            type: SchemaType.STRING,
            description: "Một câu ngắn: trong chữ này thì chỗ nào là chỗ dễ sai",
          },
        },
        required: ["text", "phonetic", "watchFor"],
      },
    },
  },
  required: ["items"],
};

const GRADE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    heard: {
      type: SchemaType.STRING,
      description: "Bạn nghe được người đó nói gì, ghi nguyên văn kể cả khi sai so với chữ cần đọc",
    },
    audible: { type: SchemaType.BOOLEAN, description: "false nếu đoạn thu trống hoặc không nghe ra tiếng nói" },
    accuracy: { type: SchemaType.NUMBER, description: "0-100, mức khớp với cách đọc chuẩn" },
    targetProduced: {
      type: SchemaType.BOOLEAN,
      description: "Người nói có phát ra ĐÚNG âm đang luyện hay không",
    },
    notes: { type: SchemaType.STRING, description: "Sai ở đâu, hoặc đúng ở đâu. 1-2 câu, cụ thể." },
    tip: {
      type: SchemaType.STRING,
      description: "Một việc làm được ngay với miệng, lưỡi hay hơi để lần sau đúng hơn",
    },
  },
  required: ["heard", "audible", "accuracy", "targetProduced", "notes", "tip"],
};

interface DrillItem {
  text: string;
  phonetic: string;
  watchFor: string;
}

/** Danh sách chỗ khó của thứ tiếng này. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const languageId = new URL(req.url).searchParams.get("languageId")?.trim();
  const language = languageId
    ? await prisma.language.findFirst({
        where: { id: languageId, userId: user.id },
        select: { code: true, name: true },
      })
    : null;

  const code = language?.code ?? "en";
  const targets = targetsFor(code);

  // Đã luyện chỗ nào rồi, để hiện dấu thay vì bắt người dùng tự nhớ.
  const done = await prisma.practiceItem.findMany({
    where: { userId: user.id, skill: "pronunciation", ...(languageId ? { languageId } : {}) },
    select: { topic: true, attempts: true, correctCount: true },
  });

  const seen = new Map<string, { attempts: number; correct: number }>();
  for (const row of done) {
    if (!row.topic) continue;
    const prev = seen.get(row.topic) ?? { attempts: 0, correct: 0 };
    seen.set(row.topic, {
      attempts: prev.attempts + row.attempts,
      correct: prev.correct + row.correctCount,
    });
  }

  return NextResponse.json({
    success: true,
    code,
    phoneticSystem: presetByCode(code)?.phoneticSystem ?? "ipa",
    targets: targets.map((target) => ({
      ...target,
      attempts: seen.get(target.id)?.attempts ?? 0,
      correct: seen.get(target.id)?.correct ?? 0,
    })),
  });
}

/** Soạn bài luyện cho một chỗ khó. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { languageId, targetId } = await req.json();

    const language = languageId
      ? await prisma.language.findFirst({
          where: { id: String(languageId), userId: user.id },
          select: { id: true, code: true },
        })
      : null;
    const code = language?.code ?? "en";
    const preset = presetByCode(code);
    const target = targetById(code, String(targetId ?? ""));

    if (!target) {
      return NextResponse.json({ success: false, error: "Không có mục luyện này" }, { status: 400 });
    }

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);

    const model = modelsWithFallback({
      generationConfig: { responseMimeType: "application/json", responseSchema: DRILL_SCHEMA },
      systemInstruction: `Bạn soạn một bài luyện phát âm ${preset?.nativeName ?? "English"} nhắm vào đúng một chỗ khó.

Chỗ khó: ${target.en} (${target.symbol})
Điều cần làm được: ${target.hintEn}
Ví dụ mẫu: ${target.seeds.join(", ")}

Quy tắc:
- Đưa 6 từ hoặc cụm ngắn trước, rồi 2 câu trọn vẹn sau — tổng đúng 8 mục.
- MỌI mục phải chứa chỗ khó nói trên. Mục nào không chứa nó là mục vô dụng.
- Nếu chỗ khó là một cặp âm dễ lẫn thì xếp thành cặp sát nhau, để nghe ra khác biệt.
- Từ phải là từ thật, dùng được, không phải từ sách vở không ai nói.
- "phonetic" viết theo hệ ${preset?.phoneticSystem ?? "ipa"}.
- "watchFor" viết bằng ${explainIn}, một câu ngắn.
- Đừng dùng lại nguyên văn danh sách ví dụ mẫu; lấy nó làm chuẩn rồi chọn chữ khác.`,
    });

    const result = await generateWithRetry(
      model,
      `Soạn bài luyện cho: ${target.en}`,
      { timeoutMs: 30_000 }
    );

    const parsed = JSON.parse(result.response.text()) as { items: DrillItem[] };
    const items = (parsed.items ?? []).filter((item) => item.text?.trim());

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "Không soạn được bài" }, { status: 502 });
    }

    const record = await prisma.practiceItem.create({
      data: {
        languageId: language?.id ?? null,
        skill: "pronunciation",
        level: "—",
        topic: target.id,
        content: JSON.stringify({ items }),
        userId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      itemId: record.id,
      target: {
        id: target.id,
        symbol: target.symbol,
        en: target.en, vi: target.vi,
        hintEn: target.hintEn, hintVi: target.hintVi,
      },
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không soạn được bài";
    const transient = isTransientAiError(error);
    if (!transient) console.error("Pronunciation drill error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/** Nộp một câu đã đọc. Chấm ngay câu đó. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { itemId, index, audio, mimeType } = await req.json();

    if (typeof audio !== "string" || audio.length < 500) {
      return NextResponse.json({ success: false, error: "Đoạn thu quá ngắn" }, { status: 400 });
    }
    if (audio.length > 6_000_000) {
      return NextResponse.json({ success: false, error: "Đoạn thu quá dài" }, { status: 413 });
    }

    const record = await prisma.practiceItem.findFirst({
      where: { id: String(itemId ?? ""), userId: user.id, skill: "pronunciation" },
    });
    if (!record) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài" }, { status: 404 });
    }

    const drill = JSON.parse(record.content) as { items: DrillItem[] };
    const which = drill.items[Number(index)];
    if (!which) {
      return NextResponse.json({ success: false, error: "Không có câu này trong bài" }, { status: 400 });
    }

    const language = record.languageId
      ? await prisma.language.findFirst({
          where: { id: record.languageId, userId: user.id },
          select: { code: true },
        })
      : null;
    const code = language?.code ?? "en";
    const preset = presetByCode(code);
    const target = targetById(code, record.topic ?? "");

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);

    const model = modelsWithFallback(
      {
        generationConfig: { responseMimeType: "application/json", responseSchema: GRADE_SCHEMA },
        systemInstruction: `Bạn nghe một người học đọc một chữ ${preset?.nativeName ?? "English"} và nhận xét phát âm.

Chữ cần đọc: "${which.text}"
Phiên âm chuẩn: ${which.phonetic}
${target ? `Đang luyện: ${target.en} (${target.symbol}) — ${target.hintEn}` : ""}
Chỗ dễ sai trong chữ này: ${which.watchFor}

Cách nhận xét:
- Ghi vào "heard" điều bạn NGHE ĐƯỢC, không phải chữ cần đọc. Nếu người ta đọc "tin" trong khi chữ là "thin" thì ghi "tin".
- "targetProduced" chỉ được true khi âm đang luyện thật sự phát ra đúng. Đọc trôi chảy nhưng sai đúng cái âm đó thì vẫn là false.
- "accuracy" tính trên toàn chữ, nhưng âm đang luyện có trọng số lớn nhất.
- "tip" phải là một việc làm được ngay: đặt lưỡi ở đâu, môi thế nào, hơi ra sao. Đừng viết "hãy luyện thêm".
- Đoạn thu trống hoặc không nghe ra tiếng nói thì "audible" là false, "accuracy" là 0.
- "notes" và "tip" viết bằng ${explainIn}. "heard" giữ nguyên thứ tiếng đang học.
- Nhận xét thẳng. Khen một chữ đọc sai là làm người học giữ luôn cái sai đó.`,
      },
      GEMINI_GRADING_MODEL
    );

    const result = await generateWithRetry(
      model,
      [
        { text: `Người học đọc chữ "${which.text}":` },
        { inlineData: { mimeType: typeof mimeType === "string" ? mimeType : "audio/wav", data: audio } },
      ],
      { timeoutMs: 40_000, totalBudgetMs: 70_000 }
    );

    const graded = JSON.parse(result.response.text()) as {
      heard: string;
      audible: boolean;
      accuracy: number;
      targetProduced: boolean;
      notes: string;
      tip: string;
    };

    if (graded.audible === false) {
      return NextResponse.json({
        success: false,
        error: "Không nghe được tiếng nói trong đoạn thu. Kiểm tra micro rồi đọc lại.",
      });
    }

    const accuracy = Math.max(0, Math.min(100, Math.round(Number(graded.accuracy) || 0)));

    await prisma.practiceItem.update({
      where: { id: record.id },
      data: {
        attempts: { increment: 1 },
        // "Đúng" ở đây nghĩa là phát ra được đúng âm đang luyện — đó mới là việc
        // của bài này, không phải đọc trôi cả chữ.
        correctCount: { increment: graded.targetProduced ? 1 : 0 },
        lastDoneAt: new Date(),
      },
    });

    if (record.languageId) {
      try {
        await prisma.skillProgress.upsert({
          where: {
            userId_languageId_skill: {
              userId: user.id, languageId: record.languageId, skill: "pronunciation",
            },
          },
          create: {
            userId: user.id, languageId: record.languageId, skill: "pronunciation",
            xp: graded.targetProduced ? 3 : 1, lessonsDone: 1, lastPracticedAt: new Date(),
          },
          update: {
            xp: { increment: graded.targetProduced ? 3 : 1 },
            lastPracticedAt: new Date(),
          },
        });
      } catch (progressError) {
        console.error("Skill progress write failed:", progressError);
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        heard: graded.heard ?? "",
        accuracy,
        targetProduced: Boolean(graded.targetProduced),
        notes: graded.notes ?? "",
        tip: graded.tip ?? "",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không chấm được";
    const transient = isTransientAiError(error);
    if (!transient) console.error("Pronunciation grade error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}
