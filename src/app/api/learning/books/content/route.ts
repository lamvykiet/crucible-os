import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isTransientAiError, aiErrorMessage } from "@/lib/aiRetry";
import { promptLanguageName } from "@/lib/translationLanguages";
import { bookById } from "@/lib/books";
import { generateStepContent, saveGrammarNotes } from "@/lib/bookContent";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Bài học và bài tập cho một unit trong sách.
 *
 * Khuôn và câu lệnh nằm ở `src/lib/bookContent.ts`, dùng chung với đường soạn
 * cả cuốn (`books/build`). Route này chỉ lo một unit: đọc bản đã lưu, hoặc soạn
 * một cái mới rồi lưu.
 *
 * Sinh một lần rồi LƯU: người học quay lại đọc lại bài cũ, mà bài đổi mỗi lần
 * mở thì không còn là bài của mình. Cũng là cách để phần này dùng được cả khi
 * hết hạn mức AI.
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

    const { content, grammarPoints } = await generateStepContent(book, step, part, explainIn);

    await prisma.bookLesson.upsert({
      where: key,
      create: {
        userId: user.id, bookId: book.id, step: step.step,
        [part]: JSON.stringify(content),
      },
      update: { [part]: JSON.stringify(content) },
    });

    // Ngữ pháp của unit đi thẳng vào mục Ngữ pháp. Hỏng bước này KHÔNG được làm
    // mất bài học vừa soạn — bài học là thứ người dùng đang chờ.
    if (grammarPoints.length > 0) {
      try {
        await saveGrammarNotes(user.id, book, step, grammarPoints);
      } catch (noteError) {
        console.error("Book grammar note failed:", noteError);
      }
    }

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
