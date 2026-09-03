import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Bộ thẻ của một thứ tiếng, hoặc của một lĩnh vực.
 *
 * `?languageId=` cho phần ngôn ngữ, `?domain=` cho Finance / 3D Design...
 * Cùng một bảng, cùng một API — nên khi nhân bản sang lĩnh vực khác thì không
 * phải viết lại gì.
 *
 * Mỗi bộ trả kèm số thẻ tới hạn để màn hình chỉ được ngay bộ nào cần học.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const params = new URL(req.url).searchParams;
    const languageId = params.get("languageId")?.trim() || null;
    const domain = params.get("domain")?.trim() || null;

    const decks = await prisma.deck.findMany({
      where: {
        userId: user.id,
        ...(languageId ? { languageId } : {}),
        ...(domain ? { domain } : {}),
      },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { items: true } } },
    });

    // Đếm thẻ tới hạn theo từng bộ. Gom một truy vấn rồi ghép, thay vì bắn một
    // truy vấn cho mỗi bộ.
    const now = new Date();
    const dueRows = await prisma.dictionaryItem.findMany({
      where: {
        userId: user.id,
        deckId: { in: decks.map((d) => d.id) },
        flashcard: { is: { dueDate: { lte: now } } },
      },
      select: { deckId: true },
    });
    const dueByDeck = new Map<string, number>();
    for (const row of dueRows) {
      if (row.deckId) dueByDeck.set(row.deckId, (dueByDeck.get(row.deckId) ?? 0) + 1);
    }

    // Lộ trình: bộ đầu luôn mở; bộ sau chỉ mở khi bộ liền trước đã học xong.
    // Tính ở máy chủ để giao diện không phải tự suy ra rồi suy sai.
    let previousDone = true;
    const payload = decks.map((deck) => {
      const unlocked = deck.isPreset ? previousDone : true;
      previousDone = deck.completedAt !== null;
      return {
        id: deck.id,
        name: deck.name,
        description: deck.description,
        level: deck.level,
        topic: deck.topic,
        orderIndex: deck.orderIndex,
        status: deck.status,
        isPreset: deck.isPreset,
        completedAt: deck.completedAt,
        languageId: deck.languageId,
        domain: deck.domain,
        itemCount: deck._count.items,
        dueCount: dueByDeck.get(deck.id) ?? 0,
        unlocked,
      };
    });

    return NextResponse.json({ success: true, decks: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được bộ thẻ";
    console.error("List decks error:", error);
    return NextResponse.json({ success: false, error: message, decks: [] }, { status: 500 });
  }
}

/** Tạo một bộ thẻ mới. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Chưa đặt tên bộ thẻ" }, { status: 400 });
    }

    const languageId = body.languageId ?? null;
    const domain = body.domain ?? null;
    if (!languageId && !domain) {
      return NextResponse.json(
        { success: false, error: "Bộ thẻ phải thuộc một ngôn ngữ hoặc một lĩnh vực" },
        { status: 400 }
      );
    }

    if (languageId) {
      const owned = await prisma.language.findFirst({ where: { id: languageId, userId: user.id } });
      if (!owned) {
        return NextResponse.json({ success: false, error: "Không tìm thấy ngôn ngữ" }, { status: 404 });
      }
    }

    // Bộ mới xếp xuống cuối lộ trình.
    const count = await prisma.deck.count({
      where: { userId: user.id, ...(languageId ? { languageId } : { domain }) },
    });

    const deck = await prisma.deck.create({
      data: {
        name,
        description: body.description?.trim() || null,
        level: body.level?.trim() || null,
        topic: body.topic?.trim() || null,
        orderIndex: count,
        languageId,
        domain,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, deck });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tạo được bộ thẻ";
    console.error("Create deck error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Đổi tên, tạm dừng, đổi cấp độ, hoặc đổi vị trí trong lộ trình. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id, ...rest } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const owned = await prisma.deck.findFirst({ where: { id, userId: user.id } });
    if (!owned) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bộ thẻ" }, { status: 404 });
    }

    const allowed = ["name", "description", "level", "topic", "status", "orderIndex", "completedAt"] as const;
    const data = Object.fromEntries(
      allowed.filter((k) => rest[k] !== undefined).map((k) => [k, rest[k]])
    );

    const deck = await prisma.deck.update({ where: { id }, data });
    return NextResponse.json({ success: true, deck });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không sửa được bộ thẻ";
    console.error("Update deck error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * Xoá một bộ thẻ.
 *
 * Thẻ bên trong KHÔNG mất — `DictionaryItem.deckId` chỉ về null, thẻ rơi lại
 * vào kho chung. Xoá vỏ không được phép xoá luôn ruột.
 */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const result = await prisma.deck.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bộ thẻ" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete deck error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
