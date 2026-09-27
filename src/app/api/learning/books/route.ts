import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { bookById, booksFor, stepWordCount } from "@/lib/books";

export const dynamic = "force-dynamic";

/**
 * Đường học của một cuốn sách, hoặc danh sách sách nếu không nêu tên cuốn nào.
 *
 * Trả cả đường (mọi bước) chứ không phân trang: 60 bước là ít, mà xem được cả
 * đường mới là điểm của màn này — thấy mình đang ở đâu giữa cả cuốn.
 */
async function resolveLang(userId: string, languageId?: string | null) {
  if (!languageId) return "en";
  const language = await prisma.language.findFirst({
    where: { id: languageId, userId },
    select: { code: true },
  });
  return language?.code ?? "en";
}

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const params = new URL(req.url).searchParams;
    const bookId = params.get("bookId")?.trim();
    const langCode = await resolveLang(user.id, params.get("languageId")?.trim());

    if (!bookId) {
      const books = booksFor(langCode);
      const counts = await prisma.bookStepProgress.groupBy({
        by: ["bookId"],
        where: { userId: user.id, bookId: { in: books.map((b) => b.id) }, doneAt: { not: null } },
        _count: { step: true },
      });
      const done = new Map(counts.map((c) => [c.bookId, c._count.step]));

      return NextResponse.json({
        success: true,
        books: books.map((b) => ({
          id: b.id,
          title: b.title,
          level: b.level,
          note: b.note,
          stepCount: b.steps.length,
          wordCount: stepWordCount(b),
          doneCount: done.get(b.id) ?? 0,
        })),
      });
    }

    const book = bookById(bookId);
    if (!book) {
      return NextResponse.json({ success: false, error: "Không có sách này" }, { status: 404 });
    }

    const rows = await prisma.bookStepProgress.findMany({
      where: { userId: user.id, bookId: book.id },
      select: { step: true, openedAt: true, doneAt: true },
    });
    const byStep = new Map(rows.map((r) => [r.step, r]));

    return NextResponse.json({
      success: true,
      book: {
        id: book.id,
        title: book.title,
        level: book.level,
        note: book.note,
        provenance: book.provenance,
        steps: book.steps.map((s) => ({
          step: s.step,
          label: s.label,
          kind: s.kind,
          title: s.title,
          section: s.section ?? null,
          wordCount: s.words?.length ?? 0,
          opened: byStep.get(s.step)?.openedAt != null,
          done: byStep.get(s.step)?.doneAt != null,
          // Từ KHÔNG gửi ở đây: màn đường học chỉ cần tên bước.
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được sách";
    console.error("Books error:", error);
    return NextResponse.json({ success: false, error: message, books: [] }, { status: 500 });
  }
}
