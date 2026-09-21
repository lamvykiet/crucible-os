import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { dayKey, todayStart, nextMidnight, DAY_MS, computeStreak } from "@/lib/learningDay";

export const dynamic = "force-dynamic";

/**
 * Thông báo trong ứng dụng.
 *
 * Hai nguồn:
 *  - Sinh tại chỗ từ trạng thái thật (chuỗi sắp đứt, thử thách sắp hết giờ).
 *    Những cái này KHÔNG lưu xuống bảng: chúng hết hiệu lực sau vài giờ, và
 *    một bảng đầy thông báo cũ đã hết đúng thì còn tệ hơn là không có.
 *  - Đọc từ bảng `Notification`, dành cho thứ cần giữ lại.
 *
 * Đây là thông báo hệ thống gửi cho người dùng, không phải nhật ký hoạt động —
 * thứ đó đã nằm ở `ReviewLog` và hiện ở màn Lịch sử.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const now = new Date();
    const start = todayStart();
    const end = nextMidnight();

    const [stored, reviewDays, todayReviews, challenge] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.flashcard.findMany({
        where: { userId: user.id, lastReview: { not: null } },
        orderBy: { lastReview: "desc" },
        take: 400,
        select: { lastReview: true },
      }),
      prisma.reviewLog.count({ where: { userId: user.id, reviewedAt: { gte: start, lt: end } } }),
      prisma.dailyTask.findFirst({
        where: { userId: user.id, kind: "challenge", taskDate: { gte: start, lt: end } },
      }),
    ]);

    const days = new Set(reviewDays.map((r) => dayKey(r.lastReview!)));
    const streak = computeStreak(days, now);
    const live: Array<{ id: string; title: string; body: string; kind: string; href: string | null }> = [];

    // Chuỗi đang có mà hôm nay chưa học: nhắc trước khi mất.
    if (streak > 0 && todayReviews === 0) {
      live.push({
        id: "live:streak",
        title: `Chuỗi ${streak} ngày đang chờ bạn`,
        body: "Hôm nay chưa ôn thẻ nào. Ôn một thẻ là chuỗi được giữ.",
        kind: "streak",
        href: "/learning/flashcards",
      });
    }

    // Thử thách chưa xong mà sắp hết ngày.
    if (challenge && !challenge.completedAt) {
      const hoursLeft = (end.getTime() - now.getTime()) / 3_600_000;
      if (hoursLeft <= 6) {
        live.push({
          id: "live:challenge",
          title: "Thử thách hôm nay sắp hết giờ",
          body: challenge.label ?? "Còn nhiệm vụ chưa hoàn thành.",
          kind: "challenge",
          href: "/learning",
        });
      }
    }

    // Lâu không học: nhắc một lần, không nhắc mỗi ngày cho đỡ phiền.
    const lastDay = [...days].sort().pop();
    if (lastDay && streak === 0) {
      const gap = Math.floor((now.getTime() - new Date(`${lastDay}T00:00:00.000Z`).getTime()) / DAY_MS);
      if (gap >= 3 && gap <= 30) {
        live.push({
          id: "live:comeback",
          title: `Đã ${gap} ngày chưa ôn`,
          body: "Bắt lại bằng năm thẻ thôi cũng được.",
          kind: "info",
          href: "/learning/flashcards",
        });
      }
    }

    const unread = live.length + stored.filter((n) => !n.readAt).length;

    return NextResponse.json({
      success: true,
      unread,
      live,
      stored: stored.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        kind: n.kind,
        href: n.href,
        read: n.readAt !== null,
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được thông báo";
    console.error("Notifications error:", error);
    return NextResponse.json({ success: false, error: message, live: [], stored: [] }, { status: 500 });
  }
}

/** Đánh dấu đã đọc. Không truyền id thì đánh dấu hết. */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await req.json().catch(() => ({}));
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(id ? { id: String(id) } : {}) },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark notification error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
