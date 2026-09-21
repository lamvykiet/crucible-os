import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { STATE } from "@/lib/fsrs";
import { todayStart, nextMidnight } from "@/lib/learningDay";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

/**
 * Kho thẻ.
 *
 * Trước đây thẻ nằm rải hai chỗ: kho thuật ngữ (danh sách phẳng) và màn bộ thẻ
 * (chỉ thấy tên bộ, không thấy thẻ bên trong). Không có chỗ nào trả lời được
 * "những thẻ tôi đã thuộc là thẻ nào" hay "hôm nay tôi phải ôn lại cái gì".
 *
 * Ba bộ lọc, đúng ba câu hỏi người học hay hỏi:
 *  - all      : mọi thẻ
 *  - relearn  : thẻ tới hạn hôm nay, hoặc vừa quên trong ngày
 *  - mastered : đã vào giai đoạn ôn dài hạn và chưa tới hạn
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const params = new URL(req.url).searchParams;
    const filter = params.get("filter") ?? "all";
    const deckId = params.get("deck")?.trim() || null;
    const search = params.get("search")?.trim() || null;
    const page = Math.max(0, Number(params.get("page")) || 0);

    const now = new Date();

    // Thẻ "cần ôn lại": tới hạn rồi, hoặc hôm nay đã chấm quên ít nhất một lần.
    let relearnIds: string[] = [];
    if (filter === "relearn") {
      const logs = await prisma.reviewLog.findMany({
        where: {
          userId: user.id,
          reviewedAt: { gte: todayStart(), lt: nextMidnight() },
          grade: { lte: 2 },
        },
        select: { itemId: true },
      });
      relearnIds = [...new Set(logs.map((l) => l.itemId).filter((x): x is string => !!x))];
    }

    const where = {
      userId: user.id,
      ...(deckId ? { deckId } : {}),
      ...(search
        ? {
            OR: [
              { term: { contains: search, mode: "insensitive" as const } },
              { definition: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(filter === "relearn"
        ? {
            OR: [
              { flashcard: { is: { dueDate: { lte: now } } } },
              ...(relearnIds.length ? [{ id: { in: relearnIds } }] : []),
            ],
          }
        : {}),
      ...(filter === "mastered"
        ? { flashcard: { is: { state: STATE.REVIEW, dueDate: { gt: now } } } }
        : {}),
    };

    const [items, total, decks] = await Promise.all([
      prisma.dictionaryItem.findMany({
        where,
        include: {
          flashcard: { select: { id: true, dueDate: true, state: true, reps: true } },
          deck: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.dictionaryItem.count({ where }),
      prisma.deck.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, _count: { select: { items: true } } },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    return NextResponse.json({
      success: true,
      items,
      total,
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      decks: decks.map((d) => ({ id: d.id, name: d.name, count: d._count.items })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được kho thẻ";
    console.error("Inventory error:", error);
    return NextResponse.json({ success: false, error: message, items: [] }, { status: 500 });
  }
}

/**
 * Xoá nhiều thẻ một lượt.
 *
 * Nút "Clear all cards" của bản tham chiếu xoá sạch kho — quá dễ bấm nhầm cho
 * một hành động không lùi lại được. Ở đây bắt buộc gửi danh sách id cụ thể,
 * nên "xoá hết" phải do giao diện chọn hết rồi xác nhận, không phải một cú bấm.
 */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { ids } = await req.json();
    const list = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
    if (list.length === 0) {
      return NextResponse.json({ success: false, error: "Chưa chọn thẻ nào" }, { status: 400 });
    }

    // Thẻ ghi nhớ đi theo nhờ onDelete: Cascade trên Flashcard.itemId.
    const result = await prisma.dictionaryItem.deleteMany({
      where: { id: { in: list }, userId: user.id },
    });

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không xoá được";
    console.error("Inventory delete error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
