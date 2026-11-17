export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMonth } from "@/lib/netWorth";
import { readSeries, rebuildSeries, refreshCurrentMonth } from "@/lib/netWorthServer";

// Tài sản ròng theo tháng. Cách tính và giới hạn của các tháng quá khứ: `src/lib/netWorth.ts`.

/**
 * GET ?months=12 (1–60) — chuỗi bản chụp đã lưu, cũ → mới. Mỗi lần gọi chụp lại
 * THÁNG ĐANG CHẠY (mở dashboard là cập nhật). Tháng quá khứ chỉ có khi đã dựng
 * lại bằng POST; chưa có thì `snapshots` rỗng — không bịa.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const raw = Number(new URL(req.url).searchParams.get("months") ?? 12);
    const months = Number.isInteger(raw) ? Math.min(60, Math.max(1, raw)) : 12;
    const now = new Date();

    // Lỗi chụp tháng này không được làm hỏng việc đọc chuỗi đã lưu.
    let refreshError: string | null = null;
    try {
      await refreshCurrentMonth(user.id, now);
    } catch (e) {
      refreshError = e instanceof Error ? e.message : "refresh failed";
      console.error("Net worth refresh error:", e);
    }

    const snapshots = await readSeries(user.id, months, now);
    return NextResponse.json({ success: true, data: { months, snapshots, refreshError } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    console.error("Net worth GET error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST {dryRun?, from?, to?, force?} — dựng lại các tháng quá khứ (đến tháng
 * trước tháng hiện tại). `dryRun: true` chỉ tính và trả kết quả, KHÔNG ghi.
 * Mặc định giữ nguyên bản chụp `computed` của tháng đã qua; `force` mới đè.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const body = await req.json().catch(() => ({}));
    const from = body?.from === undefined ? undefined : String(body.from);
    const to = body?.to === undefined ? undefined : String(body.to);
    if ((from !== undefined && !isMonth(from)) || (to !== undefined && !isMonth(to))) {
      return NextResponse.json({ success: false, error: "from/to phải có dạng YYYY-MM" }, { status: 400 });
    }

    const result = await rebuildSeries(user.id, {
      from,
      to,
      dryRun: body?.dryRun === true,
      force: body?.force === true,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server Error";
    console.error("Net worth rebuild error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
