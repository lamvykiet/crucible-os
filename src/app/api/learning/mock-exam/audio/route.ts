import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Lời thoại của một đoạn trong phần Nghe, để trình duyệt đọc lên.
 *
 * Đề phần Nghe không kèm lời thoại, nên mỗi lượt phát phải xin riêng ở đây.
 * Nói thẳng: việc này KHÔNG ngăn được người cố tình gian lận — giọng đọc chạy ở
 * trình duyệt nên chữ buộc phải về tới máy, mở tab mạng ra là thấy. Nó chỉ ngăn
 * chuyện vô tình đọc phải lời thoại nằm sẵn trong trang.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { examId, index } = await req.json();

    const exam = await prisma.mockExam.findFirst({
      where: { id: String(examId ?? ""), userId: user.id },
      select: { sections: true },
    });
    if (!exam) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài thi" }, { status: 404 });
    }

    const sections = JSON.parse(exam.sections) as {
      listening?: { passages: { body: string }[] };
    };
    const body = sections.listening?.passages?.[Number(index)]?.body;

    if (!body) {
      return NextResponse.json({ success: false, error: "Không có đoạn này" }, { status: 404 });
    }

    return NextResponse.json({ success: true, body });
  } catch (error) {
    console.error("Mock exam audio error:", error);
    return NextResponse.json({ success: false, error: "Không lấy được lời thoại" }, { status: 500 });
  }
}
