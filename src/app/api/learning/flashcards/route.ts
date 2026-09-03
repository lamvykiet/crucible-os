import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { schedule, previewIntervals, STATE, type Grade, type CardState } from "@/lib/fsrs";

export const dynamic = "force-dynamic";

const DEFAULT_BATCH = 30;

function toCardState(card: {
  stability: number; difficulty: number; elapsedDays: number; scheduledDays: number;
  reps: number; state: number; lastReview: Date | null; dueDate: Date;
}): CardState {
  return { ...card };
}

/**
 * Hàng ôn hôm nay.
 *
 * Trả về thẻ đã tới hạn (`dueDate <= now`), thẻ đang học trước, rồi tới thẻ mới.
 * Kèm sẵn khoảng cách dự kiến của cả bốn lựa chọn để nút hiện "3 ngày", "2
 * tháng" thay cho các nhãn viết cứng "(1m) (10m) (1d) (4d)" của bản cũ — những
 * con số đó không liên quan gì tới thẻ đang xem.
 *
 * `?domain=` giới hạn phiên ôn trong một lĩnh vực. Learning Hub không phục vụ
 * riêng một môn, nên ôn "tất cả" sẽ trộn thuật ngữ tài chính với từ vựng tiếng
 * Anh trong cùng một chồng thẻ — học được, nhưng não phải nhảy ngữ cảnh liên
 * tục. Lọc theo lĩnh vực cho phép ngồi xuống ôn đúng một mảng.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const params = new URL(req.url).searchParams;
    const limit = Math.min(Number(params.get("limit")) || DEFAULT_BATCH, 100);
    const domain = params.get("domain")?.trim() || null;
    const deckId = params.get("deck")?.trim() || null;
    const now = new Date();

    // Lĩnh vực nằm trên mục từ điển, không nằm trên thẻ. Thẻ tạo tay (không gắn
    // mục từ điển nào) vì vậy chỉ xuất hiện khi ôn tất cả.
    // Lọc theo bộ thẻ chặt hơn lọc theo lĩnh vực, nên nó thắng khi có cả hai.
    // Bộ đang tạm dừng thì thẻ của nó không vào hàng ôn — trừ khi người dùng
    // mở thẳng đúng bộ đó, lúc ấy rõ ràng là họ đang cố ý ôn nó.
    const scope = deckId
      ? { dictionaryItem: { is: { deckId } } }
      : domain
        ? {
            dictionaryItem: {
              is: {
                domain: { equals: domain, mode: "insensitive" as const },
                OR: [{ deck: { is: { status: "active" } } }, { deckId: null }],
              },
            },
          }
        : {};

    const [due, newCount, total, dueCount] = await Promise.all([
      prisma.flashcard.findMany({
        where: { userId: user.id, dueDate: { lte: now }, ...scope },
        orderBy: [{ state: "desc" }, { dueDate: "asc" }],
        take: limit,
        include: {
          dictionaryItem: {
            select: {
              term: true, domain: true, phonetic: true, tone: true,
              example: true, exampleTranslation: true, imageUrl: true,
              language: true,
            },
          },
        },
      }),
      prisma.flashcard.count({ where: { userId: user.id, state: STATE.NEW, ...scope } }),
      prisma.flashcard.count({ where: { userId: user.id, ...scope } }),
      // Đếm riêng chứ không lấy `due.length`: `due` đã bị `take: limit` cắt, nên
      // còn 80 thẻ tới hạn thì thanh tiến độ vẫn báo 30.
      prisma.flashcard.count({ where: { userId: user.id, dueDate: { lte: now }, ...scope } }),
    ]);

    // Kho nghĩa để làm phương án nhiễu. Lấy trong cùng phạm vi đang ôn thì
    // phương án sai mới hợp lý — trộn nghĩa tiếng Hàn vào câu tiếng Pháp thì
    // đoán mò cũng trúng.
    const distractorRows = await prisma.dictionaryItem.findMany({
      where: { userId: user.id, ...(scope.dictionaryItem?.is ?? {}) },
      select: { definition: true },
      take: 60,
    });
    const distractors = [...new Set(distractorRows.map((d) => d.definition))];

    return NextResponse.json({
      success: true,
      total,
      newCount,
      dueCount,
      domain,
      cards: due.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        state: c.state,
        reps: c.reps,
        domain: c.dictionaryItem?.domain ?? null,
        // Phần dựng bài tập: điền khuyết cần biết đáp án là từ nào, luyện thanh
        // cần số thanh, nghe cần biết đọc bằng thứ tiếng nào.
        itemId: c.dictionaryItem ? c.itemId : null,
        term: c.dictionaryItem?.term ?? null,
        phonetic: c.dictionaryItem?.phonetic ?? null,
        tone: c.dictionaryItem?.tone ?? null,
        example: c.dictionaryItem?.example ?? null,
        exampleTranslation: c.dictionaryItem?.exampleTranslation ?? null,
        imageUrl: c.dictionaryItem?.imageUrl ?? null,
        language: c.dictionaryItem?.language
          ? {
              id: c.dictionaryItem.language.id,
              code: c.dictionaryItem.language.code,
              name: c.dictionaryItem.language.name,
              script: c.dictionaryItem.language.script,
              phoneticSystem: c.dictionaryItem.language.phoneticSystem,
              hasTones: c.dictionaryItem.language.hasTones,
              toneCount: c.dictionaryItem.language.toneCount,
            }
          : null,
        intervals: previewIntervals(toCardState(c), now),
      })),
      // Nghĩa của các thẻ khác, dùng làm phương án nhiễu cho câu trắc nghiệm.
      // Lấy sẵn ở đây để mỗi câu không phải bắn thêm một request.
      distractors,
    });
  } catch (error) {
    console.error("List due cards error:", error);
    return NextResponse.json(
      { success: false, error: "Server Error", cards: [], total: 0, newCount: 0, dueCount: 0 },
      { status: 500 }
    );
  }
}

/** Chấm điểm một thẻ và ghi lại lịch mới do FSRS tính. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id, grade, mode, correct } = await req.json();

    if (!id || ![1, 2, 3, 4].includes(Number(grade))) {
      return NextResponse.json(
        { success: false, error: "Thiếu id hoặc mức đánh giá không hợp lệ" },
        { status: 400 }
      );
    }

    const card = await prisma.flashcard.findUnique({ where: { id } });
    if (!card || card.userId !== user.id) {
      return NextResponse.json({ success: false, error: "Không tìm thấy thẻ" }, { status: 404 });
    }

    const next = schedule(toCardState(card), Number(grade) as Grade);

    const updated = await prisma.flashcard.update({
      where: { id },
      data: {
        stability: next.stability,
        difficulty: next.difficulty,
        elapsedDays: next.elapsedDays,
        scheduledDays: next.scheduledDays,
        reps: next.reps,
        state: next.state,
        lastReview: next.lastReview,
        dueDate: next.dueDate,
      },
    });

    // Ghi lại lượt ôn. `Flashcard` chỉ giữ trạng thái hiện tại, nên thiếu bảng
    // này thì không dựng được lịch sử theo ngày lẫn biểu đồ thống kê.
    // Ghi hỏng thì cũng không được làm hỏng lượt ôn vừa chấm xong.
    try {
      const item = card.itemId
        ? await prisma.dictionaryItem.findUnique({
            where: { id: card.itemId },
            select: { deckId: true, languageId: true },
          })
        : null;

      await prisma.reviewLog.create({
        data: {
          flashcardId: card.id,
          itemId: card.itemId,
          deckId: item?.deckId ?? null,
          languageId: item?.languageId ?? null,
          grade: Number(grade),
          state: next.state,
          mode: typeof mode === "string" ? mode : "flashcard",
          correct: typeof correct === "boolean" ? correct : null,
          userId: user.id,
        },
      });
    } catch (logError) {
      console.error("Review log write failed:", logError);
    }

    return NextResponse.json({
      success: true,
      card: { id: updated.id, dueDate: updated.dueDate, state: updated.state, reps: updated.reps },
      intervalMinutes: next.intervalMinutes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lưu được kết quả ôn";
    console.error("Review card error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Xoá một thẻ khỏi bộ ôn. */
export async function DELETE(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const result = await prisma.flashcard.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy thẻ" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete card error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
