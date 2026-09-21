import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { todayStart, nextMidnight, secondsToMidnight, DAY_MS } from "@/lib/learningDay";

export const dynamic = "force-dynamic";

/**
 * Thử thách hôm nay.
 *
 * Khác "việc hôm nay" ở chỗ: việc hôm nay là danh sách cố định người dùng tự
 * bật tắt, còn thử thách là MỘT nhiệm vụ đổi theo ngày, có thưởng và có hạn
 * chót. Hết ngày là mất, nên nó mới tạo ra sức thúc.
 *
 * Chỉ tiêu suy từ chính kho thẻ của người dùng, không phải con số viết cứng:
 * bắt người mới có 12 thẻ phải "ôn 30 thẻ" thì thử thách vĩnh viễn bất khả thi.
 */

/** Các dạng nhiệm vụ. Chọn dạng nào là theo ngày, nên hôm nay ai cũng biết trước. */
const KINDS = ["review", "newCards", "accuracy"] as const;

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const start = todayStart();
    const end = nextMidnight();
    const now = new Date();

    let challenge = await prisma.dailyTask.findFirst({
      where: { userId: user.id, kind: "challenge", taskDate: { gte: start, lt: end } },
    });

    if (!challenge) {
      const [dueCount, newCount] = await Promise.all([
        prisma.flashcard.count({ where: { userId: user.id, dueDate: { lte: now } } }),
        prisma.flashcard.count({ where: { userId: user.id, state: 0 } }),
      ]);

      // Xoay vòng theo số thứ tự ngày, để hôm nay và mai không trùng dạng.
      const dayIndex = Math.floor(start.getTime() / DAY_MS);
      const kind = KINDS[dayIndex % KINDS.length];

      // Chỉ tiêu bám theo thực tế, và luôn ít nhất 1 để không ra nhiệm vụ rỗng.
      const target =
        kind === "review" ? Math.max(1, Math.min(30, dueCount || 10))
        : kind === "newCards" ? Math.max(1, Math.min(10, newCount || 5))
        : 10;

      const label =
        kind === "review" ? `Ôn ${target} thẻ tới hạn`
        : kind === "newCards" ? `Học ${target} thẻ mới`
        : `Trả lời đúng ${target} câu bài tập`;

      challenge = await prisma.dailyTask.create({
        data: {
          taskDate: start,
          kind: "challenge",
          label,
          target,
          reward: 10,
          userId: user.id,
        },
      });
    }

    // Tiến độ đọc từ nhật ký ôn thật, không tin cột `progress` đã lưu — người
    // dùng ôn ở màn khác thì con số đó lạc hậu ngay.
    const logs = await prisma.reviewLog.findMany({
      where: { userId: user.id, reviewedAt: { gte: start, lt: end } },
      select: { state: true, correct: true, grade: true },
    });

    const label = challenge.label ?? "";
    const progress =
      label.includes("thẻ mới") ? logs.filter((l) => l.state === 1).length
      : label.includes("bài tập") ? logs.filter((l) => l.correct === true).length
      : logs.length;

    const capped = Math.min(progress, challenge.target);
    const done = capped >= challenge.target;

    return NextResponse.json({
      success: true,
      challenge: {
        id: challenge.id,
        label: challenge.label,
        target: challenge.target,
        progress: capped,
        reward: challenge.reward,
        done,
      },
      // Đồng hồ đếm ngược tính ở máy chủ: máy đặt sai múi giờ mà tự suy nửa
      // đêm thì sẽ đếm lệch hẳn vài tiếng so với lúc nhiệm vụ thật sự đổi.
      secondsLeft: secondsToMidnight(now),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được thử thách";
    console.error("Daily challenge error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** Nhận thưởng khi đã hoàn thành. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id } = await req.json();
    const challenge = await prisma.dailyTask.findFirst({
      where: { id: String(id ?? ""), userId: user.id, kind: "challenge" },
    });
    if (!challenge) {
      return NextResponse.json({ success: false, error: "Không tìm thấy thử thách" }, { status: 404 });
    }
    // Đã nhận rồi thì thôi — bấm hai lần không được cộng thưởng hai lần.
    if (challenge.completedAt) {
      return NextResponse.json({ success: false, error: "Đã nhận thưởng rồi" }, { status: 409 });
    }

    const start = todayStart();
    const end = nextMidnight();
    const reviews = await prisma.reviewLog.count({
      where: { userId: user.id, reviewedAt: { gte: start, lt: end } },
    });
    if (reviews < challenge.target) {
      return NextResponse.json({ success: false, error: "Chưa hoàn thành" }, { status: 400 });
    }

    const [, pref] = await prisma.$transaction([
      prisma.dailyTask.update({
        where: { id: challenge.id },
        data: { completedAt: new Date(), progress: challenge.target },
      }),
      prisma.learnerPref.update({
        where: { userId: user.id },
        data: { diamonds: { increment: challenge.reward } },
      }),
    ]);

    return NextResponse.json({ success: true, diamonds: pref.diamonds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không nhận được thưởng";
    console.error("Claim challenge error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
