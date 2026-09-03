import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { STATE } from "@/lib/fsrs";

export const dynamic = "force-dynamic";

/**
 * Múi giờ dùng để cắt ngày.
 *
 * "Hôm nay" và "chuỗi ngày học" chỉ có nghĩa khi có một mốc nửa đêm cố định.
 * Máy chủ chạy UTC, nên nếu cắt theo giờ máy chủ thì buổi ôn lúc 22h tối ở Việt
 * Nam sẽ bị tính sang ngày hôm sau và chuỗi đứt oan. Chốt theo giờ Việt Nam.
 */
const TZ = "Asia/Ho_Chi_Minh";
const DAY_MS = 86_400_000;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Ngày dạng YYYY-MM-DD theo giờ Việt Nam. */
const dayKey = (d: Date) => dayFormatter.format(d);

/**
 * Số ngày ôn liên tiếp tính tới hôm nay.
 *
 * Chưa ôn hôm nay thì chuỗi vẫn còn — nó chỉ đứt khi cả hôm qua cũng trống.
 * Nếu không, mở ứng dụng lúc sáng sớm sẽ thấy chuỗi về 0 dù chưa hết ngày.
 */
function computeStreak(days: Set<string>, now: Date): number {
  let cursor = now;

  if (!days.has(dayKey(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

/** Gom theo tên lĩnh vực, không phân biệt hoa thường và khoảng trắng thừa. */
const normalize = (domain: string | null | undefined) =>
  (domain ?? "").trim().toLowerCase();

interface DomainStat {
  domain: string;
  termCount: number;
  cardCount: number;
  dueCount: number;
  newCount: number;
}

/**
 * Số liệu học tập của mọi lĩnh vực trong một lần gọi.
 *
 * Learning Hub không phục vụ riêng một môn nào: lĩnh vực là thư mục Drive do
 * người dùng tự đặt, và cùng một bộ công cụ (thẻ ghi nhớ, thuật ngữ, thi thử)
 * chạy cho tất cả. Trang chủ cần biết *mỗi lĩnh vực* còn bao nhiêu thẻ tới hạn
 * để chỉ đúng chỗ cần học, nên phần đếm gom hết ở đây thay vì để trình duyệt
 * bắn một request cho mỗi lĩnh vực.
 *
 * Danh sách lĩnh vực vẫn do /api/learning/domains trả về (đọc Drive, chậm hơn).
 * Route này chỉ đọc Postgres nên trang hiện số liệu được ngay, không phải chờ
 * Drive trả lời.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const now = new Date();

    const [cards, terms, attempts, reviewDays] = await Promise.all([
      prisma.flashcard.findMany({
        where: { userId: user.id },
        select: {
          state: true,
          dueDate: true,
          dictionaryItem: { select: { domain: true } },
        },
      }),
      prisma.dictionaryItem.findMany({
        where: { userId: user.id },
        select: { domain: true },
      }),
      prisma.examAttempt.findMany({
        where: { userId: user.id, completed: true },
        orderBy: { completedAt: "desc" },
        take: 3,
        select: {
          id: true,
          sourceName: true,
          questionCount: true,
          correctCount: true,
          completedAt: true,
        },
      }),
      prisma.flashcard.findMany({
        where: { userId: user.id, lastReview: { not: null } },
        orderBy: { lastReview: "desc" },
        take: 1000,
        select: { lastReview: true },
      }),
    ]);

    // Một bảng gom, khoá là tên lĩnh vực đã chuẩn hoá. Giữ lại cách viết đầu
    // tiên gặp được để hiện đúng chữ hoa chữ thường người dùng đã gõ.
    const byDomain = new Map<string, DomainStat>();
    const bucket = (raw: string | null | undefined) => {
      const key = normalize(raw);
      let stat = byDomain.get(key);
      if (!stat) {
        stat = { domain: (raw ?? "").trim(), termCount: 0, cardCount: 0, dueCount: 0, newCount: 0 };
        byDomain.set(key, stat);
      }
      return stat;
    };

    for (const term of terms) bucket(term.domain).termCount += 1;

    let dueCount = 0;
    let newCount = 0;

    for (const card of cards) {
      const stat = bucket(card.dictionaryItem?.domain);
      stat.cardCount += 1;

      if (card.dueDate <= now) {
        stat.dueCount += 1;
        dueCount += 1;
      }
      if (card.state === STATE.NEW) {
        stat.newCount += 1;
        newCount += 1;
      }
    }

    const days = new Set(reviewDays.map((r) => dayKey(r.lastReview!)));
    const today = dayKey(now);

    return NextResponse.json({
      success: true,
      totals: {
        cardCount: cards.length,
        termCount: terms.length,
        dueCount,
        newCount,
        reviewedToday: reviewDays.filter((r) => dayKey(r.lastReview!) === today).length,
        streak: computeStreak(days, now),
      },
      domains: [...byDomain.values()].sort((a, b) => b.dueCount - a.dueCount),
      attempts: attempts.map((a) => ({
        id: a.id,
        sourceName: a.sourceName,
        questionCount: a.questionCount,
        correctCount: a.correctCount,
        completedAt: a.completedAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được số liệu học tập";
    console.error("Learning overview error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
