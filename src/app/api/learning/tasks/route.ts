import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TZ = "Asia/Ho_Chi_Minh";
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Nửa đêm hôm nay theo giờ Việt Nam, lưu dưới dạng mốc UTC. */
function todayStart(): Date {
  return new Date(`${dayFormatter.format(new Date())}T00:00:00.000Z`);
}

/**
 * Việc cần làm trong ngày.
 *
 * Ba việc mặc định được tạo trong lần mở đầu tiên mỗi ngày. Đây là *khung đếm*
 * chứ không phải dữ liệu bịa: tiến độ luôn tính từ `ReviewLog` thật, và việc
 * nào chưa làm thì đứng ở 0. Người dùng ẩn bớt hoặc sửa chỉ tiêu tuỳ ý.
 */
const DEFAULT_TASKS = [
  { kind: "review", label: "Ôn hết thẻ tới hạn", target: 20, reward: 5 },
  { kind: "newCards", label: "Học thẻ mới", target: 5, reward: 3 },
  { kind: "pomodoro", label: "Một phiên tập trung", target: 1, reward: 2 },
];

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const taskDate = todayStart();
    const nextDay = new Date(taskDate.getTime() + 86_400_000);

    let tasks = await prisma.dailyTask.findMany({
      where: { userId: user.id, taskDate: { gte: taskDate, lt: nextDay } },
      orderBy: { createdAt: "asc" },
    });

    if (tasks.length === 0) {
      await prisma.dailyTask.createMany({
        data: DEFAULT_TASKS.map((t) => ({ ...t, taskDate, userId: user.id })),
      });
      tasks = await prisma.dailyTask.findMany({
        where: { userId: user.id, taskDate: { gte: taskDate, lt: nextDay } },
        orderBy: { createdAt: "asc" },
      });
    }

    // Tiến độ đọc từ nhật ký ôn thật, không tin vào con số đã lưu — nếu người
    // dùng ôn ở màn khác thì cột `progress` sẽ lạc hậu.
    const logs = await prisma.reviewLog.findMany({
      where: { userId: user.id, reviewedAt: { gte: taskDate, lt: nextDay } },
      select: { state: true },
    });

    const reviewed = logs.length;
    const learnedNew = logs.filter((l) => l.state === 1).length;

    const withProgress = tasks.map((t) => {
      const progress =
        t.kind === "review" ? reviewed
        : t.kind === "newCards" ? learnedNew
        : t.progress;
      return { ...t, progress: Math.min(progress, t.target) };
    });

    const visible = withProgress.filter((t) => t.visible);
    const doneCount = visible.filter((t) => t.progress >= t.target).length;

    return NextResponse.json({
      success: true,
      tasks: withProgress,
      // Phần trăm hoàn thành trong ngày, để vẽ vòng tiến độ.
      percent: visible.length ? Math.round((doneCount / visible.length) * 100) : 0,
      reward: visible.filter((t) => t.progress >= t.target).reduce((s, t) => s + t.reward, 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được nhiệm vụ";
    console.error("Daily tasks error:", error);
    return NextResponse.json({ success: false, error: message, tasks: [] }, { status: 500 });
  }
}

/** Đổi chỉ tiêu, màu, ẩn/hiện, hoặc cộng tiến độ cho việc tự đếm (Pomodoro). */
export async function PATCH(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { id, increment, ...rest } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });

    const owned = await prisma.dailyTask.findFirst({ where: { id, userId: user.id } });
    if (!owned) return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });

    const allowed = ["label", "target", "visible", "color"] as const;
    const data: Record<string, unknown> = Object.fromEntries(
      allowed.filter((k) => rest[k] !== undefined).map((k) => [k, rest[k]])
    );

    if (data.target !== undefined) {
      data.target = Math.min(500, Math.max(1, Number(data.target) || 1));
    }

    // Pomodoro không để lại dấu vết trong `ReviewLog`, nên nó tự cộng tiến độ.
    if (increment) {
      const next = Math.min(owned.progress + Number(increment), owned.target);
      data.progress = next;
      if (next >= owned.target && !owned.completedAt) data.completedAt = new Date();
    }

    const task = await prisma.dailyTask.update({ where: { id }, data });
    return NextResponse.json({ success: true, task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không sửa được";
    console.error("Update task error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
