import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isDailyQuotaError, isTransientAiError, aiErrorMessage } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import { bookById } from "@/lib/books";
import {
  generateStepContent, saveGrammarNotes, remapBookGrammar, type Part,
} from "@/lib/bookContent";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Soạn cả cuốn sách, mỗi lượt gọi một ít.
 *
 * Không thể soạn 56 unit trong một lượt: mỗi unit cần hai lượt gọi AI, mỗi lượt
 * mươi giây, mà một request chỉ có 60 giây. Nên việc chia thành hàng đợi những
 * cặp (bước, phần) còn thiếu, mỗi request làm vài cặp rồi trả về số còn lại;
 * giao diện gọi lại tới khi hết. Nhờ vậy đóng trang giữa lúc soạn cũng không
 * mất gì: lần sau mở ra, hàng đợi tự tính lại từ những gì đã có trong bảng.
 *
 * Hạn mức AI của gói miễn phí tính theo NGÀY, nên cả cuốn thường không soạn hết
 * trong một buổi. Gặp lỗi hết hạn mức thì dừng hẳn và nói rõ, chứ không thử lại
 * — thử lại một việc không thể thành công chỉ làm người dùng chờ vô ích.
 */

/**
 * Một lượt gọi AI mỗi request.
 *
 * Phần bài tập có thể mất tới 50 giây một mình, mà request chỉ có 60. Gộp hai
 * lượt vào một request là cầm chắc lượt thứ hai bị cắt giữa chừng — đã đo đúng
 * cảnh đó ngày 27/09/2026: request 57 giây, lượt bài tập bị huỷ và cả vòng soạn
 * dừng. Nhiều request ngắn thì chậm hơn chút nhưng không mất việc nào.
 */
const CALLS_PER_REQUEST = 1;
const MAX_CALLS_PER_REQUEST = 2;

interface Job {
  step: number;
  part: Part;
}

/** Những cặp (bước, phần) còn thiếu, theo đúng thứ tự học. */
const jobKey = (step: number, part: Part) => `${step}:${part}`;

async function pendingJobs(userId: string, bookId: string, steps: number[]) {
  const rows = await prisma.bookLesson.findMany({
    where: { userId, bookId },
    select: { step: true, lesson: true, exercises: true },
  });
  const have = new Map(rows.map((r) => [r.step, r]));

  const jobs: Job[] = [];
  for (const step of steps) {
    const row = have.get(step);
    // Lý thuyết trước bài tập, vì soạn nửa vời thì người học nên có phần lý
    // thuyết trước — luyện trước khi biết quy tắc là đoán mò.
    if (!row?.lesson) jobs.push({ step, part: "lesson" });
    if (!row?.exercises) jobs.push({ step, part: "exercises" });
  }
  return jobs;
}

/** Đã soạn tới đâu. */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const bookId = new URL(req.url).searchParams.get("bookId")?.trim() ?? "";
    const book = bookById(bookId);
    if (!book) {
      return NextResponse.json({ success: false, error: "Không có sách này" }, { status: 404 });
    }

    const steps = book.steps.map((s) => s.step);
    const jobs = await pendingJobs(user.id, book.id, steps);
    const [grammarNotes, looseNotes] = await Promise.all([
      prisma.bookGrammarNote.count({ where: { userId: user.id, bookId: book.id } }),
      prisma.bookGrammarNote.count({
        where: { userId: user.id, bookId: book.id, syllabusPointId: null },
      }),
    ]);

    const total = steps.length * 2;
    return NextResponse.json({
      success: true,
      stepCount: steps.length,
      total,
      done: total - jobs.length,
      remaining: jobs.length,
      grammarNotes,
      /** Điểm đang đứng riêng, chưa gộp được vào khung. */
      looseNotes,
      nextStep: jobs[0]?.step ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được tiến độ";
    console.error("Book build status error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Soạn thêm vài phần còn thiếu. Gọi lại tới khi `remaining` về 0. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const made: { step: number; label: string; part: Part }[] = [];

  try {
    const body = await req.json().catch(() => ({}));
    const book = bookById(String(body.bookId ?? ""));
    if (!book) {
      return NextResponse.json({ success: false, error: "Không có sách này" }, { status: 404 });
    }

    const budget = Math.min(
      MAX_CALLS_PER_REQUEST,
      Math.max(1, Number(body.calls) || CALLS_PER_REQUEST)
    );

    // Những phần vừa hỏng trong cùng phiên soạn. Bỏ qua để đi tiếp, thay vì đâm
    // đầu vào đúng phần đó mãi — hàng đợi luôn lấy phần thiếu đầu tiên, nên
    // không bỏ qua là cả cuốn đứng lại vì một unit.
    const skip = new Set<string>(
      Array.isArray(body.skip) ? body.skip.map(String) : []
    );

    // HAI danh sách, và không được lẫn: `jobs` là những phần còn thiếu THẬT,
    // dùng để đếm tiến độ; `queue` là phần sẽ làm lượt này. Đếm theo `queue` là
    // tính phần bỏ qua thành đã xong, và con số trên màn hình nhích lên trong
    // khi trong bảng không có gì thêm — đã quan sát đúng cảnh đó.
    const jobs = await pendingJobs(user.id, book.id, book.steps.map((s) => s.step));
    const queue = jobs.filter((j) => !skip.has(jobKey(j.step, j.part)));
    const total = book.steps.length * 2;
    const progress = () => ({ total, done: total - jobs.length + made.length });

    if (jobs.length === 0) {
      return NextResponse.json({
        success: true, total, done: total, remaining: 0, made, complete: true,
      });
    }

    // Còn phần thiếu nhưng đều nằm trong danh sách bỏ qua: không còn gì làm
    // được lượt này, nói thẳng thay vì trả về một lượt rỗng để giao diện đoán.
    if (queue.length === 0) {
      return NextResponse.json({
        ...progress(), success: true,
        remaining: jobs.length, made, stopped: "skipped",
      });
    }

    const pref = await prisma.learnerPref.findUnique({
      where: { userId: user.id },
      select: { translationLanguage: true },
    });
    const explainIn = promptLanguageName(pref?.translationLanguage);

    // Dừng trước khi request chạm trần 60 giây: trả về phần đã soạn còn hơn để
    // cả request bị cắt và mất luôn việc vừa làm.
    const deadline = Date.now() + 52_000;

    for (const job of queue.slice(0, budget)) {
      if (Date.now() > deadline) break;

      const step = book.steps.find((s) => s.step === job.step);
      if (!step) continue;

      try {
        const { content, grammarPoints } = await generateStepContent(
          book, step, job.part, explainIn, { light: body.light === true }
        );

        await prisma.bookLesson.upsert({
          where: { userId_bookId_step: { userId: user.id, bookId: book.id, step: step.step } },
          create: {
            userId: user.id, bookId: book.id, step: step.step,
            [job.part]: JSON.stringify(content),
          },
          update: { [job.part]: JSON.stringify(content) },
        });

        if (grammarPoints.length > 0) {
          try {
            await saveGrammarNotes(user.id, book, step, grammarPoints);
          } catch (noteError) {
            console.error("Book grammar note failed:", noteError);
          }
        }

        made.push({ step: step.step, label: step.label, part: job.part });
      } catch (stepError) {
        // Hết hạn mức ngày thì dừng hẳn cả vòng: mọi model đã cạn, unit sau
        // cũng sẽ cạn. Trả về success để giao diện hiện được phần đã soạn.
        if (isDailyQuotaError(stepError)) {
          return NextResponse.json({
            ...progress(), success: true,
            remaining: jobs.length - made.length,
            made,
            stopped: "quota",
            error: aiErrorMessage(stepError),
          });
        }
        // Hỏng vì lý do khác — hay gặp nhất là một lượt chạy quá lâu rồi bị
        // huỷ. Báo đúng phần hỏng để giao diện xếp nó vào danh sách bỏ qua và
        // đi tiếp; phần đó vẫn còn thiếu nên phiên sau sẽ soạn lại.
        console.error(`Book build failed at step ${step.step} (${job.part}):`, stepError);
        return NextResponse.json({
          ...progress(), success: true,
          remaining: jobs.length - made.length,
          made,
          failed: { step: step.step, label: step.label, part: job.part },
          stopped: isTransientAiError(stepError) ? "transient" : "error",
          error: aiErrorMessage(stepError),
        });
      }
    }

    const remaining = jobs.length - made.length;
    return NextResponse.json({
      ...progress(), success: true,
      remaining,
      made,
      complete: remaining === 0,
    });
  } catch (error) {
    const message = aiErrorMessage(error);
    console.error("Book build error:", error);
    return NextResponse.json({ success: false, error: message, made }, { status: 200 });
  }
}

/**
 * Đối chiếu lại những điểm ngữ pháp của sách đang đứng riêng với khung.
 *
 * Việc đối chiếu vốn xảy ra lúc soạn bài từng unit, nhưng nó có thể hụt — và
 * mỗi lần hụt là một điểm trùng nằm cạnh điểm cũ, buộc người học tự đoán nên
 * đọc cái nào. Soạn lại cả cuốn để sửa thì tốn cả trăm lượt gọi; đường này chỉ
 * tốn MỘT, vì nó chỉ so tên chứ không viết lại nội dung gì.
 */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { bookId } = await req.json().catch(() => ({}));
    const book = bookById(String(bookId ?? ""));
    if (!book) {
      return NextResponse.json({ success: false, error: "Không có sách này" }, { status: 404 });
    }

    const { checked, merged } = await remapBookGrammar(user.id, book);
    return NextResponse.json({ success: true, checked, merged });
  } catch (error) {
    const message = aiErrorMessage(error);
    const transient = isTransientAiError(error);
    if (!transient) console.error("Book grammar remap error:", error);
    return NextResponse.json({ success: false, error: message, transient }, { status: 200 });
  }
}
