import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { bookById } from "@/lib/books";

export const dynamic = "force-dynamic";

/**
 * Một bước trên đường học: tên unit, danh sách từ, và những từ đã đánh dấu.
 *
 * Từ đánh dấu lưu thẳng vào ngân hàng từ vựng (`DictionaryItem`) với thẻ
 * `<bookId>` và `marked`, thay vì đẻ thêm một bảng riêng. Nhờ vậy từ đánh dấu
 * và từ học qua giáo trình nằm chung một chỗ, lọc ra được bằng thẻ, và không
 * phải đồng bộ hai nguồn.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const params = new URL(req.url).searchParams;
  const book = bookById(params.get("bookId")?.trim() ?? "");
  const stepNo = Number(params.get("step"));
  const step = book?.steps.find((s) => s.step === stepNo);

  if (!book || !step) {
    return NextResponse.json({ success: false, error: "Không có bước này" }, { status: 404 });
  }

  // Mở ra là ghi mốc đã xem. Hỏng bước này không được chặn việc đọc bài.
  try {
    await prisma.bookStepProgress.upsert({
      where: { userId_bookId_step: { userId: user.id, bookId: book.id, step: step.step } },
      create: { userId: user.id, bookId: book.id, step: step.step, openedAt: new Date() },
      update: { openedAt: new Date() },
    });
  } catch (openError) {
    console.error("Book step open failed:", openError);
  }

  const terms = (step.words ?? []).map((w) => w.term);
  const marked = terms.length
    ? await prisma.dictionaryItem.findMany({
        where: { userId: user.id, term: { in: terms }, tags: { has: "marked" } },
        select: { term: true },
      })
    : [];
  const markedSet = new Set(marked.map((m) => m.term.toLowerCase()));

  const progress = await prisma.bookStepProgress.findUnique({
    where: { userId_bookId_step: { userId: user.id, bookId: book.id, step: step.step } },
    select: { doneAt: true },
  });

  return NextResponse.json({
    success: true,
    book: { id: book.id, title: book.title, provenance: book.provenance },
    step: {
      step: step.step,
      label: step.label,
      kind: step.kind,
      title: step.title,
      section: step.section ?? null,
      done: progress?.doneAt != null,
      words: (step.words ?? []).map((w) => ({
        term: w.term,
        ipa: w.ipa,
        marked: markedSet.has(w.term.toLowerCase()),
      })),
    },
  });
}

/** Đánh dấu một từ cần học, hoặc bỏ đánh dấu. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { bookId, term, marked, languageId } = await req.json();
    const book = bookById(String(bookId ?? ""));
    const word = String(term ?? "").trim();

    if (!book || !word) {
      return NextResponse.json({ success: false, error: "Thiếu từ" }, { status: 400 });
    }

    const existing = await prisma.dictionaryItem.findFirst({
      where: { userId: user.id, term: word },
      select: { id: true, tags: true },
    });

    if (marked === false) {
      if (existing) {
        await prisma.dictionaryItem.update({
          where: { id: existing.id },
          data: { tags: existing.tags.filter((tg) => tg !== "marked") },
        });
      }
      return NextResponse.json({ success: true, marked: false });
    }

    if (existing) {
      // Đã có trong ngân hàng thì chỉ thêm thẻ, KHÔNG đụng vào nghĩa đã có.
      const tags = [...new Set([...existing.tags, book.id, "marked"])];
      await prisma.dictionaryItem.update({ where: { id: existing.id }, data: { tags } });
    } else {
      const language = languageId
        ? await prisma.language.findFirst({
            where: { id: String(languageId), userId: user.id },
            select: { id: true },
          })
        : null;
      const found = book.steps.flatMap((s) => s.words ?? []).find((w) => w.term === word);

      await prisma.dictionaryItem.create({
        data: {
          userId: user.id,
          languageId: language?.id ?? null,
          term: word,
          // Chưa tra nghĩa thì để trống, không bịa. Tra bằng AI sẽ điền sau.
          definition: "",
          phonetic: found?.ipa || null,
          tags: [book.id, "marked"],
        },
      });
    }

    return NextResponse.json({ success: true, marked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đánh dấu được";
    console.error("Mark word error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Đánh dấu cả bước là đã học xong, hoặc bỏ đánh dấu. */
export async function PUT(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { bookId, step, done } = await req.json();
    const book = bookById(String(bookId ?? ""));
    if (!book || !book.steps.some((s) => s.step === Number(step))) {
      return NextResponse.json({ success: false, error: "Không có bước này" }, { status: 404 });
    }

    await prisma.bookStepProgress.upsert({
      where: { userId_bookId_step: { userId: user.id, bookId: book.id, step: Number(step) } },
      create: {
        userId: user.id, bookId: book.id, step: Number(step),
        openedAt: new Date(), doneAt: done === false ? null : new Date(),
      },
      update: { doneAt: done === false ? null : new Date() },
    });

    return NextResponse.json({ success: true, done: done !== false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được";
    console.error("Book step done error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
