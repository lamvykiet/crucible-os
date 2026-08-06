import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Từ điển cá nhân.
 *
 * Bản cũ của DictionaryTab render bốn mục viết cứng ngay trong component
 * (Glassmorphism, Supabase, FSRS, EBITDA) và nút "Thêm từ" không có `onClick` —
 * bảng `DictionaryItem` đã tồn tại trong schema nhưng chưa từng có ai ghi vào.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const tag = searchParams.get("tag")?.trim();

    const items = await prisma.dictionaryItem.findMany({
      where: {
        userId: user.id,
        ...(tag ? { tags: { has: tag } } : {}),
        ...(search
          ? {
              OR: [
                { term: { contains: search, mode: "insensitive" as const } },
                { definition: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      include: { flashcard: { select: { id: true, dueDate: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Danh sách thẻ để lọc lấy từ chính dữ liệu, không phải bảng cố định.
    const allTags = Array.from(new Set(items.flatMap((i) => i.tags))).sort();

    return NextResponse.json({ success: true, items, tags: allTags });
  } catch (error) {
    console.error("List dictionary error:", error);
    return NextResponse.json(
      { success: false, error: "Server Error", items: [], tags: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const term = String(body.term ?? "").trim();
    const definition = String(body.definition ?? "").trim();

    if (!term || !definition) {
      return NextResponse.json(
        { success: false, error: "Cần có từ và định nghĩa" },
        { status: 400 }
      );
    }

    const tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 10)
      : [];

    const item = await prisma.dictionaryItem.create({
      data: {
        term,
        definition,
        phonetic: body.phonetic?.trim() || null,
        example: body.example?.trim() || null,
        domain: body.domain?.trim() || null,
        tags,
        userId: user.id,
        // Tạo luôn thẻ ghi nhớ nếu người dùng muốn — quan hệ 1-1 đã có sẵn
        // trong schema qua `Flashcard.itemId`, trước nay chưa dùng tới.
        ...(body.createFlashcard
          ? {
              flashcard: {
                create: { front: term, back: definition, userId: user.id },
              },
            }
          : {}),
      },
      include: { flashcard: { select: { id: true, dueDate: true } } },
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được từ";
    console.error("Create dictionary item error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    // Thẻ ghi nhớ gắn với từ này bị xoá theo, nhờ onDelete: Cascade trên
    // `Flashcard.itemId`.
    const result = await prisma.dictionaryItem.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy từ" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete dictionary item error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
