import { NextResponse } from "next/server";
import { recentSubTopics, videoOwnerId } from "@/lib/videoQueue";
import { NEW_LABEL, NO_LABEL, videoTokenProblem } from "@/lib/videoShare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/video/share/labels  { "topic": "3D Design" }
 *
 * Bước 2 của Shortcut "Gửi vào Crucible": nhãn con đã dùng trong đề tài vừa
 * chọn, để popup thứ hai cho bấm chọn thay vì gõ lại.
 *
 * Vì sao là một lượt gọi riêng thay vì trả sẵn cả bảng {đề tài: [nhãn]} ở bước
 * 1: "Get Dictionary Value" của Shortcuts hiểu dấu chấm trong khoá là đường dẫn
 * lồng nhau, nên đề tài tên "Mẹo v2.0" sẽ tra ra rỗng — và "Choose from List"
 * gặp danh sách rỗng là dừng cả Shortcut.
 *
 * `choices` không bao giờ rỗng: luôn có `NO_LABEL` ở đầu và `NEW_LABEL` ở cuối.
 */
export async function POST(req: Request) {
  const problem = videoTokenProblem(req);
  if (problem) return NextResponse.json({ success: false, error: problem.error }, { status: problem.status });

  const body = (await req.json().catch(() => null)) as { topic?: unknown } | null;
  const topic = String(body?.topic ?? "").trim();

  try {
    const userId = await videoOwnerId();
    const labels = userId && topic ? await recentSubTopics(userId, topic) : [];
    return NextResponse.json({ success: true, choices: [NO_LABEL, ...labels, NEW_LABEL] });
  } catch (error) {
    console.error("Video share labels error:", error);
    // Lỗi DB cũng không được làm rơi link: vẫn cho chọn "không nhãn" / "nhãn mới".
    return NextResponse.json({ success: true, choices: [NO_LABEL, NEW_LABEL] });
  }
}
