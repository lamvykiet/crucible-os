import { NextResponse } from "next/server";
import { SchemaType, type Schema } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { modelsWithFallback, GEMINI_GRADING_MODEL } from "@/lib/gemini";
import { generateWithRetry, isTransientAiError, aiErrorMessage } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import {
  EXAM_SECTIONS, WRITING_TASKS, WRITING_CRITERIA, SPEAKING_PARTS, SPEAKING_CRITERIA,
  rawToBand, roundBand, overallWritingBand, overallSpeakingBand, overallExamBand,
} from "@/lib/ieltsFormat";

export const runtime = "nodejs";
export const maxDuration = 180;

/**
 * Thi thử đủ bốn kỹ năng.
 *
 * Về phạm vi: cấu trúc bài thi (bốn phần, thời lượng, số câu, các dạng câu hỏi)
 * là thông tin công khai về cách kỳ thi vận hành — đó là dữ kiện. Đề ở đây do
 * AI soạn mới; dự án KHÔNG chép đề thật, không dùng bảng mô tả band chính thức,
 * và bảng quy đổi điểm thô sang band là bảng xấp xỉ của dự án (xem
 * `src/lib/ieltsFormat.ts`).
 *
 * Nội dung sinh theo từng phần lúc người thi mở tới, không sinh sẵn cả bài: đủ
 * bốn phần cần bảy lượt gọi AI, bắt ngồi chờ hai phút trước khi bắt đầu là hỏng
 * cả cảm giác vào phòng thi. Trong một phần thì các đoạn sinh SONG SONG.
 *
 * Đáp án không bao giờ gửi xuống trình duyệt lúc phát đề — chấm ở máy chủ, rồi
 * mới trả đáp án kèm giải thích.
 */

/** Số câu mỗi đoạn, cộng lại đúng 40 cho mỗi phần. */
const LISTENING_PARTS = [10, 10, 10, 10];
const READING_PASSAGES = [13, 13, 14];

interface Question {
  type: "choice" | "tfng" | "gap";
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface Passage {
  title: string;
  body: string;
  questions: Question[];
}

const QUESTION_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    body: { type: SchemaType.STRING },
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            description: "choice | tfng | gap",
          },
          prompt: { type: SchemaType.STRING },
          options: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "choice: 4 phương án. tfng: đúng 3 là TRUE, FALSE, NOT GIVEN. gap: để mảng rỗng.",
          },
          answer: {
            type: SchemaType.STRING,
            description: "Đáp án đúng, chép nguyên văn một phần tử trong options. Với gap thì là từ cần điền.",
          },
          explanation: { type: SchemaType.STRING, description: "Vì sao đúng, dẫn ra chỗ trong bài" },
        },
        required: ["type", "prompt", "options", "answer", "explanation"],
      },
    },
  },
  required: ["title", "body", "questions"],
};

const WRITING_GRADE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    taskResponse: { type: SchemaType.NUMBER },
    coherence: { type: SchemaType.NUMBER },
    lexis: { type: SchemaType.NUMBER },
    grammar: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
  },
  required: ["taskResponse", "coherence", "lexis", "grammar", "summary"],
};

const SPEAKING_GRADE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    transcript: { type: SchemaType.STRING },
    audible: { type: SchemaType.BOOLEAN },
    fluency: { type: SchemaType.NUMBER },
    lexis: { type: SchemaType.NUMBER },
    grammar: { type: SchemaType.NUMBER },
    pronunciation: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
  },
  required: ["transcript", "audible", "fluency", "lexis", "grammar", "pronunciation", "summary"],
};

type Sections = Record<string, unknown>;

const readSections = (raw: string): Sections => {
  try {
    return JSON.parse(raw) as Sections;
  } catch {
    return {};
  }
};

/** Chuẩn hoá trước khi so đáp án điền từ: bỏ hoa thường, dấu câu và mạo từ thừa. */
const normalise = (value: string) =>
  value.toLowerCase().trim().replace(/[.,!?;:"']/g, "").replace(/^(a|an|the)\s+/, "").replace(/\s+/g, " ");

/** Soạn một đoạn kèm câu hỏi. */
async function buildPassage(opts: {
  skill: "listening" | "reading";
  index: number;
  count: number;
  explainIn: string;
  avoid: string[];
}): Promise<Passage> {
  const isListening = opts.skill === "listening";

  // Bốn phần Nghe đi từ hội thoại đời thường tới bài giảng học thuật; ba bài
  // Đọc khó dần. Đó là hình dạng thật của bài thi, không phải bốn đoạn giống nhau.
  const shape = isListening
    ? [
        "hội thoại hai người về việc đời thường (đặt chỗ, hỏi thông tin dịch vụ)",
        "một người nói về một địa điểm hoặc sự kiện, có số liệu và chỉ dẫn",
        "hội thoại hai tới ba người bàn về một bài tập hoặc dự án học thuật",
        "một bài giảng ngắn về chủ đề học thuật",
      ][opts.index] ?? "một đoạn nói"
    : [
        "chủ đề đời sống hoặc xã hội, dễ nhất trong ba bài",
        "chủ đề công việc, giáo dục hoặc môi trường, khó vừa",
        "chủ đề học thuật có lập luận và quan điểm trái chiều, khó nhất",
      ][opts.index] ?? "một bài đọc";

  const model = modelsWithFallback({
    generationConfig: { responseMimeType: "application/json", responseSchema: QUESTION_SCHEMA },
    systemInstruction: `Bạn soạn ${
      isListening ? `Phần ${opts.index + 1} của bài thi NGHE` : `Bài đọc ${opts.index + 1} của bài thi ĐỌC`
    } tiếng Anh theo định dạng thi học thuật.

Dạng của đoạn này: ${shape}

"body" là ${
      isListening
        ? "LỜI THOẠI để máy đọc lên: văn nói tự nhiên, ghi rõ người nói bằng \"A:\" và \"B:\" nếu là hội thoại"
        : "đoạn văn viết hoàn chỉnh, có lập luận"
    }, dài ${isListening ? "350-500" : "700-900"} từ.

Cần đúng ${opts.count} câu hỏi, trộn các dạng:
- "choice": 4 phương án, một đáp án đúng.
- "tfng": options đúng bằng ["TRUE","FALSE","NOT GIVEN"]. Dùng đúng nghĩa: NOT GIVEN là bài KHÔNG nói tới, khác với FALSE là bài nói ngược lại.
- "gap": điền một tới ba từ LẤY NGUYÊN TỪ BÀI, options để mảng rỗng.

Quy tắc:
- Mọi câu hỏi phải trả lời được TỪ CHÍNH BÀI, không đòi kiến thức ngoài.
- Câu hỏi đi theo thứ tự thông tin xuất hiện trong bài.
- "answer" phải chép đúng một phần tử trong "options" (với gap thì là từ trong bài).
- Phương án sai phải là hiểu nhầm hợp lý, không phải phương án ngớ ngẩn.
- "explanation" viết bằng ${opts.explainIn} và chỉ ra chỗ nào trong bài cho đáp án đó.
- Tự soạn hoàn toàn, không lấy đề hay bài đọc từ sách luyện thi hay trang web nào.`,
  });

  const result = await generateWithRetry(
    model,
    opts.avoid.length > 0 ? `Tránh các chủ đề đã dùng trong bài thi này: ${opts.avoid.join(", ")}` : "Tự chọn chủ đề.",
    { timeoutMs: 60_000, totalBudgetMs: 90_000 }
  );

  const parsed = JSON.parse(result.response.text()) as Passage;

  const questions = (parsed.questions ?? []).filter((q) => {
    if (!q.prompt?.trim() || !q.answer?.trim()) return false;
    if (q.type === "gap") return true;
    return Array.isArray(q.options) && q.options.length >= 2 && q.options.includes(q.answer);
  });

  return { title: parsed.title ?? "", body: parsed.body ?? "", questions };
}

/** Bắt đầu một lượt thi. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { languageId } = await req.json().catch(() => ({}));

  const exam = await prisma.mockExam.create({
    data: { userId: user.id, languageId: languageId ?? null },
  });

  return NextResponse.json({
    success: true,
    examId: exam.id,
    sections: EXAM_SECTIONS,
  });
}

/** Mở một phần: soạn đề nếu chưa có, rồi trả đề (KHÔNG kèm đáp án). */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { examId, section } = await req.json();
    if (!["listening", "reading", "writing", "speaking"].includes(section)) {
      return NextResponse.json({ success: false, error: "Phần thi không hợp lệ" }, { status: 400 });
    }

    const exam = await prisma.mockExam.findFirst({
      where: { id: String(examId ?? ""), userId: user.id },
    });
    if (!exam) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài thi" }, { status: 404 });
    }

    const sections = readSections(exam.sections);

    // Đã soạn rồi thì dùng lại — tải lại trang không được ra đề khác.
    if (sections[section]) {
      return NextResponse.json({ success: true, section, ...stripAnswers(section, sections[section]) });
    }

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);

    let built: unknown;

    if (section === "listening" || section === "reading") {
      const counts = section === "listening" ? LISTENING_PARTS : READING_PASSAGES;

      // Soạn song song: bốn lượt nối đuôi nhau là một phút chờ, song song là
      // khoảng ba mươi giây.
      //
      // Nhưng `Promise.all` thì MỘT đoạn hỏng là mất cả phần, mà với ba đến bốn
      // lượt gọi dài thì xác suất một lượt gặp 503 không hề nhỏ. Nên giữ lại
      // những đoạn đã soạn được rồi thử lại riêng những đoạn hỏng, nối đuôi để
      // đỡ dồn tải vào đúng lúc model đang quá tải.
      const settled = await Promise.allSettled(
        counts.map((count, index) =>
          buildPassage({ skill: section, index, count, explainIn, avoid: [] })
        )
      );

      const passages: (Passage | null)[] = settled.map((r) =>
        r.status === "fulfilled" ? r.value : null
      );

      for (let index = 0; index < passages.length; index++) {
        if (passages[index] !== null) continue;
        passages[index] = await buildPassage({
          skill: section,
          index,
          count: counts[index],
          explainIn,
          avoid: passages.filter(Boolean).map((p) => p!.title),
        });
      }

      built = { passages: passages as Passage[] };
    } else if (section === "writing") {
      const model = modelsWithFallback({
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              task1: { type: SchemaType.STRING },
              task1Data: { type: SchemaType.STRING, description: "Số liệu tả bằng chữ để thí sinh viết dựa vào" },
              task2: { type: SchemaType.STRING },
            },
            required: ["task1", "task1Data", "task2"],
          },
        },
        systemInstruction: `Bạn soạn đề phần VIẾT của một bài thi tiếng Anh học thuật.

${WRITING_TASKS.map((t) => `${t.en}: ${t.briefEn} Tối thiểu ${t.minWords} từ, ${t.minMinutes} phút.`).join("\n")}

Task 1 cần "task1Data": mô tả bộ số liệu bằng chữ (bảng số theo năm, theo nhóm...) để thí sinh có cái mà tả, vì đề này không kèm hình.
Đề viết bằng tiếng Anh, tự soạn, không lấy từ sách luyện thi nào.`,
      });
      const result = await generateWithRetry(model, "Soạn một đề Viết.", { timeoutMs: 40_000 });
      built = JSON.parse(result.response.text());
    } else {
      const model = modelsWithFallback({
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              part1: { type: SchemaType.STRING },
              part2: { type: SchemaType.STRING },
              part3: { type: SchemaType.STRING },
            },
            required: ["part1", "part2", "part3"],
          },
        },
        systemInstruction: `Bạn soạn đề phần NÓI của một bài thi tiếng Anh, đủ ba phần và CÙNG MỘT MẠCH chủ đề: Part 3 phải nối tiếp chủ đề của Part 2, đó là cách bài thi thật vận hành.

${SPEAKING_PARTS.map((p) => `${p.en}: ${p.briefEn}`).join("\n")}

Part 1: 3 câu hỏi ngắn, đánh số, mỗi câu một dòng.
Part 2: thẻ đề dạng "Describe …" rồi "You should say:" với 3-4 gạch đầu dòng, mỗi dòng một ý, kết bằng "and explain …".
Part 3: 3 câu hỏi trừu tượng nối từ chủ đề Part 2, mỗi câu một dòng.
Viết bằng tiếng Anh, tự soạn.`,
      });
      const result = await generateWithRetry(model, "Soạn một đề Nói.", { timeoutMs: 40_000 });
      built = JSON.parse(result.response.text());
    }

    sections[section] = built;
    await prisma.mockExam.update({
      where: { id: exam.id },
      data: { sections: JSON.stringify(sections) },
    });

    return NextResponse.json({ success: true, section, ...stripAnswers(section, built) });
  } catch (error) {
    const message = aiErrorMessage(error);
    const transient = isTransientAiError(error);
    if (!transient) console.error("Mock exam build error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/** Bỏ đáp án và, với phần Nghe, bỏ cả lời thoại trước khi gửi xuống trình duyệt. */
function stripAnswers(section: string, built: unknown) {
  if (section === "listening" || section === "reading") {
    const { passages } = built as { passages: Passage[] };
    return {
      passages: passages.map((p) => ({
        title: p.title,
        // Bài nghe giấu lời thoại: gửi kèm là biến bài nghe thành bài đọc.
        body: section === "listening" ? null : p.body,
        questions: p.questions.map((q) => ({ type: q.type, prompt: q.prompt, options: q.options })),
      })),
    };
  }
  return built as Record<string, unknown>;
}

/** Nộp một phần. Chấm rồi lưu. */
export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { examId, section, answers, essays, recordings } = await req.json();

    const exam = await prisma.mockExam.findFirst({
      where: { id: String(examId ?? ""), userId: user.id },
    });
    if (!exam) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài thi" }, { status: 404 });
    }

    const sections = readSections(exam.sections);
    const content = sections[section];
    if (!content) {
      return NextResponse.json({ success: false, error: "Phần này chưa mở" }, { status: 400 });
    }

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);

    const update: Record<string, unknown> = {};
    let payload: Record<string, unknown> = {};

    if (section === "listening" || section === "reading") {
      const { passages } = content as { passages: Passage[] };
      const given: string[] = Array.isArray(answers) ? answers.map((a) => String(a ?? "")) : [];

      let at = 0;
      let raw = 0;
      const results = passages.map((passage) =>
        passage.questions.map((q) => {
          const mine = given[at] ?? "";
          const correct =
            q.type === "gap"
              ? normalise(mine) === normalise(q.answer)
              : mine === q.answer;
          if (correct) raw += 1;
          at += 1;
          return { correct, answer: q.answer, mine, explanation: q.explanation };
        })
      );

      const band = rawToBand(raw, section);
      update[section === "listening" ? "listeningRaw" : "readingRaw"] = raw;
      payload = {
        raw,
        total: at,
        band,
        results,
        // Giờ mới trả lời thoại — bài đã làm xong nên không còn là gian lận.
        bodies: section === "listening" ? passages.map((p) => p.body) : undefined,
      };
    } else if (section === "writing") {
      const prompts = content as { task1: string; task1Data: string; task2: string };
      const written = (essays ?? {}) as { task1?: string; task2?: string };

      const gradeOne = async (taskId: "task1" | "task2", prompt: string, essay: string) => {
        if (!essay?.trim()) return null;
        const spec = WRITING_TASKS.find((t) => t.id === taskId)!;
        const model = modelsWithFallback(
          {
            generationConfig: { responseMimeType: "application/json", responseSchema: WRITING_GRADE_SCHEMA },
            systemInstruction: `Bạn chấm ${spec.en} của một bài thi viết tiếng Anh, thang 0-9, cho phép nửa điểm.

Bốn tiêu chí:
${WRITING_CRITERIA.map((c) => `- ${c.en}: ${c.whatEn}`).join("\n")}

Yêu cầu của phần này: ${spec.briefEn} Tối thiểu ${spec.minWords} từ.
Viết thiếu số từ tối thiểu thì "taskResponse" phải bị trừ và nói rõ trong "summary".
"summary" viết bằng ${explainIn}. Chấm thẳng thắn.`,
          },
          GEMINI_GRADING_MODEL
        );
        const result = await generateWithRetry(
          model,
          `Đề:\n${prompt}\n\nBài làm (${essay.trim().split(/\s+/).length} từ):\n${essay.slice(0, 12_000)}`,
          { timeoutMs: 50_000, totalBudgetMs: 80_000 }
        );
        const g = JSON.parse(result.response.text()) as Record<string, number | string>;
        const criteria = {
          taskResponse: roundBand(Number(g.taskResponse)),
          coherence: roundBand(Number(g.coherence)),
          lexis: roundBand(Number(g.lexis)),
          grammar: roundBand(Number(g.grammar)),
        };
        const mean =
          (criteria.taskResponse + criteria.coherence + criteria.lexis + criteria.grammar) / 4;
        return { criteria, band: roundBand(mean), summary: String(g.summary ?? "") };
      };

      const [one, two] = await Promise.all([
        gradeOne("task1", `${prompts.task1}\n\n${prompts.task1Data}`, written.task1 ?? ""),
        gradeOne("task2", prompts.task2, written.task2 ?? ""),
      ]);

      const band = overallWritingBand(one?.band ?? null, two?.band ?? null);
      update.writingBand = band;
      payload = { band, task1: one, task2: two };
    } else {
      const prompts = content as { part1: string; part2: string; part3: string };
      const given = (recordings ?? {}) as Record<string, { audio?: string; seconds?: number }>;

      const gradeTurn = async (partId: "part1" | "part2" | "part3") => {
        const turn = given[partId];
        if (!turn?.audio || turn.audio.length < 1000) return null;
        const spec = SPEAKING_PARTS.find((p) => p.id === partId)!;
        const model = modelsWithFallback(
          {
            generationConfig: { responseMimeType: "application/json", responseSchema: SPEAKING_GRADE_SCHEMA },
            systemInstruction: `Bạn nghe ${spec.en} của một bài thi nói tiếng Anh và chấm bốn tiêu chí, thang 0-9, cho phép nửa điểm.

${SPEAKING_CRITERIA.map((c) => `- ${c.en}: ${c.whatEn}`).join("\n")}

Yêu cầu phần này: ${spec.briefEn} Thí sinh nói khoảng ${spec.seconds} giây.
Gỡ băng NGUYÊN VĂN vào "transcript", giữ cả chỗ ngập ngừng và nói sai.
Chấm "pronunciation" theo âm thật nghe được. Nói quá ngắn thì trừ và nói rõ.
Đoạn thu trống thì "audible" là false và điểm để 0.
"summary" viết bằng ${explainIn}. Chấm thẳng thắn.`,
          },
          GEMINI_GRADING_MODEL
        );
        const result = await generateWithRetry(
          model,
          [
            { text: `Đề:\n${prompts[partId]}\n\nBài nói (${Math.round(Number(turn.seconds) || 0)} giây):` },
            { inlineData: { mimeType: "audio/wav", data: turn.audio } },
          ],
          { timeoutMs: 60_000, totalBudgetMs: 100_000 }
        );
        const g = JSON.parse(result.response.text()) as Record<string, number | string | boolean>;
        if (g.audible === false) return null;
        const criteria = {
          fluency: roundBand(Number(g.fluency)),
          lexis: roundBand(Number(g.lexis)),
          grammar: roundBand(Number(g.grammar)),
          pronunciation: roundBand(Number(g.pronunciation)),
        };
        return {
          criteria,
          band: overallSpeakingBand(criteria),
          transcript: String(g.transcript ?? ""),
          summary: String(g.summary ?? ""),
        };
      };

      // Nối đuôi chứ không song song: ba đoạn âm thanh gửi cùng lúc là một yêu
      // cầu rất nặng, và quá tải thì hỏng cả ba thay vì hỏng một.
      const turns: Record<string, unknown> = {};
      const bands: number[] = [];
      for (const partId of ["part1", "part2", "part3"] as const) {
        const graded = await gradeTurn(partId);
        turns[partId] = graded;
        if (graded?.band !== null && graded?.band !== undefined) bands.push(graded.band);
      }

      const band = bands.length > 0 ? roundBand(bands.reduce((a, b) => a + b, 0) / bands.length) : null;
      update.speakingBand = band;
      payload = { band, turns };
    }

    // Đủ bốn phần mới có band tổng. Thiếu một phần thì để null chứ không đưa ra
    // trung bình ba phần và gọi nó là band tổng.
    const after = { ...exam, ...update } as typeof exam;
    const overall = overallExamBand({
      listening: after.listeningRaw === null ? null : rawToBand(after.listeningRaw, "listening"),
      reading: after.readingRaw === null ? null : rawToBand(after.readingRaw, "reading"),
      writing: after.writingBand,
      speaking: after.speakingBand,
    });

    await prisma.mockExam.update({
      where: { id: exam.id },
      data: {
        ...update,
        overallBand: overall,
        ...(overall !== null ? { finishedAt: new Date() } : {}),
      },
    });

    return NextResponse.json({ success: true, section, overall, ...payload });
  } catch (error) {
    const message = aiErrorMessage(error);
    const transient = isTransientAiError(error);
    if (!transient) console.error("Mock exam grade error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}

/** Trạng thái một lượt thi, hoặc danh sách các lượt đã thi. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = new URL(req.url).searchParams;
  const examId = params.get("examId")?.trim();

  if (examId) {
    const exam = await prisma.mockExam.findFirst({ where: { id: examId, userId: user.id } });
    if (!exam) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài thi" }, { status: 404 });
    }
    const sections = readSections(exam.sections);
    return NextResponse.json({
      success: true,
      exam: {
        id: exam.id,
        started: Object.keys(sections),
        listeningRaw: exam.listeningRaw,
        readingRaw: exam.readingRaw,
        listeningBand: exam.listeningRaw === null ? null : rawToBand(exam.listeningRaw, "listening"),
        readingBand: exam.readingRaw === null ? null : rawToBand(exam.readingRaw, "reading"),
        writingBand: exam.writingBand,
        speakingBand: exam.speakingBand,
        overallBand: exam.overallBand,
        startedAt: exam.startedAt,
        finishedAt: exam.finishedAt,
      },
      sections: EXAM_SECTIONS,
    });
  }

  const exams = await prisma.mockExam.findMany({
    where: { userId: user.id, ...(params.get("languageId") ? { languageId: params.get("languageId") } : {}) },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      id: true, startedAt: true, finishedAt: true, overallBand: true,
      listeningRaw: true, readingRaw: true, writingBand: true, speakingBand: true,
    },
  });

  return NextResponse.json({ success: true, exams, sections: EXAM_SECTIONS });
}
