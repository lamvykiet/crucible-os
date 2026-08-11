import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ResolveError, resolveVideo } from "@/lib/videoResolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/video/resolve  { "url": "<link Facebook hoặc TikTok>" }
 *
 * Giải một link lẻ thành link tải trực tiếp, dùng cho giao diện web (nút tải
 * ngay trong trình duyệt). Shortcut KHÔNG dùng route này — nó dùng
 * `/api/video/pending`, vì nó cần biết việc tiếp theo trong hàng đợi chứ không
 * chỉ giải một link có sẵn.
 *
 * Xác thực bằng phiên Supabase: route này chỉ được gọi từ trình duyệt đã đăng
 * nhập, nên không cần đến VIDEO_UPLOAD_TOKEN.
 */
export async function POST(request: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";

  if (!url) {
    return NextResponse.json(
      { success: false, error: "Thiếu trường 'url'.", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ success: true, data: await resolveVideo(url) });
  } catch (err) {
    if (err instanceof ResolveError) {
      // 400 khi lỗi do link người dùng đưa, 502 khi lỗi phía fdown.vn.
      const status = err.code === "UNSUPPORTED_URL" ? 400 : 502;
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message || "Lỗi không xác định.",
        code: "INTERNAL",
      },
      { status: 500 }
    );
  }
}
