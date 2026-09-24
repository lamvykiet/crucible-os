import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Lời thoại của một bài nghe, để trình duyệt đọc lên.
 *
 * Thành thật về giới hạn: giọng đọc chạy ngay trong trình duyệt, nên lời thoại
 * BẮT BUỘC phải xuống tới máy người dùng. Tách riêng thành một request như thế
 * này KHÔNG ngăn được người cố tình xem trước — mở tab mạng ra là thấy.
 *
 * Nó ngăn được thứ khác, và đó mới là mục đích: lời thoại không nằm trong HTML
 * của trang, nên mắt không vô tình lướt qua nó trong lúc nghe. Với một người
 * đang tự luyện, cám dỗ thật sự là liếc, chứ không phải mở công cụ lập trình.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { itemId } = await req.json();

    const item = await prisma.practiceItem.findFirst({
      where: { id: String(itemId ?? ""), userId: user.id, skill: "listening" },
      select: { content: true },
    });
    if (!item) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài" }, { status: 404 });
    }

    let body = "";
    try {
      body = (JSON.parse(item.content) as { body?: string }).body ?? "";
    } catch {
      return NextResponse.json({ success: false, error: "Bài hỏng dữ liệu" }, { status: 500 });
    }

    if (!body.trim()) {
      return NextResponse.json({ success: false, error: "Bài không có lời thoại" }, { status: 404 });
    }

    return NextResponse.json({ success: true, body });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không lấy được lời thoại";
    console.error("Practice audio error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
