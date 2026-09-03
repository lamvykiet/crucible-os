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
    const domain = searchParams.get("domain")?.trim();
    const deckId = searchParams.get("deck")?.trim();
    const languageId = searchParams.get("languageId")?.trim();

    const items = await prisma.dictionaryItem.findMany({
      where: {
        userId: user.id,
        ...(tag ? { tags: { has: tag } } : {}),
        ...(domain ? { domain: { equals: domain, mode: "insensitive" as const } } : {}),
        ...(deckId ? { deckId } : {}),
        ...(languageId ? { languageId } : {}),
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

    // Danh sách thẻ và lĩnh vực để lọc lấy từ chính dữ liệu, không phải bảng cố
    // định. Lĩnh vực phải đếm trên toàn bộ kho chứ không trên `items` — lọc rồi
    // thì danh sách lĩnh vực teo lại còn đúng cái đang chọn, và không bấm sang
    // lĩnh vực khác được nữa.
    const allTags = Array.from(new Set(items.flatMap((i) => i.tags))).sort();

    const domainRows = await prisma.dictionaryItem.findMany({
      where: { userId: user.id, domain: { not: null } },
      select: { domain: true },
      distinct: ["domain"],
      orderBy: { domain: "asc" },
    });
    const domains = domainRows.map((d) => d.domain!).filter((d) => d.trim());

    return NextResponse.json({ success: true, items, tags: allTags, domains });
  } catch (error) {
    console.error("List dictionary error:", error);
    return NextResponse.json(
      { success: false, error: "Server Error", items: [], tags: [], domains: [] },
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

    // Bộ thẻ và ngôn ngữ phải là của chính người dùng — nếu không thì một id
    // đoán mò trong body sẽ nhét được từ vào bộ thẻ của người khác.
    const deckId = body.deckId ? String(body.deckId) : null;
    if (deckId) {
      const owned = await prisma.deck.findFirst({ where: { id: deckId, userId: user.id } });
      if (!owned) {
        return NextResponse.json({ success: false, error: "Không tìm thấy bộ thẻ" }, { status: 404 });
      }
    }
    const languageId = body.languageId ? String(body.languageId) : null;
    if (languageId) {
      const owned = await prisma.language.findFirst({ where: { id: languageId, userId: user.id } });
      if (!owned) {
        return NextResponse.json({ success: false, error: "Không tìm thấy ngôn ngữ" }, { status: 404 });
      }
    }

    const item = await prisma.dictionaryItem.create({
      data: {
        term,
        definition,
        phonetic: body.phonetic?.trim() || null,
        example: body.example?.trim() || null,
        domain: body.domain?.trim() || null,
        tone: body.tone?.trim() || null,
        exampleTranslation: body.exampleTranslation?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        audioUrl: body.audioUrl?.trim() || null,
        deckId,
        languageId,
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
