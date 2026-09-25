import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { findSet } from "@/lib/dictationSets";

export const dynamic = "force-dynamic";

/**
 * Chữ của MỘT câu, để trình duyệt đọc lên.
 *
 * Nói thẳng: việc này KHÔNG ngăn được người cố tình gian lận. Giọng đọc chạy ở
 * trình duyệt nên chữ buộc phải về tới máy, mở tab mạng ra là thấy. Nó chỉ ngăn
 * chuyện vô tình đọc phải đáp án nằm sẵn trong trang — mà với bài chép chính
 * tả thì liếc thấy một chữ là hỏng cả câu.
 *
 * Trả từng câu một, không trả cả bộ, để mỗi lượt chỉ lộ đúng câu đang nghe.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { languageId, setId, index } = await req.json();

    const language = languageId
      ? await prisma.language.findFirst({
          where: { id: String(languageId), userId: user.id },
          select: { code: true },
        })
      : null;

    const found = findSet(language?.code ?? "en", String(setId ?? ""));
    const line = found?.set.lines[Number(index)];

    if (!line) {
      return NextResponse.json({ success: false, error: "Không có câu này" }, { status: 404 });
    }

    // Chỉ chữ để đọc. Nghĩa và phiên âm giữ lại tới lúc chấm xong.
    return NextResponse.json({ success: true, text: line.text });
  } catch (error) {
    console.error("Dictation line error:", error);
    return NextResponse.json({ success: false, error: "Không lấy được câu" }, { status: 500 });
  }
}
