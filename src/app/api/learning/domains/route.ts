import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { driveClient, knowledgeRoots, listFilesRecursive } from "@/lib/driveAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * Lĩnh vực học tập = các thư mục con của thư mục Knowledge trên Drive.
 *
 * Bản cũ viết cứng bốn lĩnh vực ở hai nơi (SubjectsTab và trang subject/[id]),
 * kèm danh sách môn học bịa ("Blender Basics", "CFA Level 1"...). Tệ hơn, trang
 * subject/[id] gọi ThreePanelWorkspace mà KHÔNG truyền folderId, nên chọn lĩnh
 * vực nào cũng ra đúng một danh sách tài liệu của thư mục gốc.
 *
 * Lấy thẳng từ Drive thì không cần bảng Subject trong Prisma, và thêm một lĩnh
 * vực chỉ là tạo một thư mục — đúng cách người dùng vẫn sắp xếp tài liệu.
 */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const roots = knowledgeRoots();
    if (roots.length === 0) {
      return NextResponse.json(
        { success: false, error: "Chưa cấu hình GOOGLE_DRIVE_KNOWLEDGE_FOLDER_ID", domains: [] },
        { status: 503 }
      );
    }

    const drive = driveClient();
    const root = roots[0];

    const folders = await drive.files.list({
      q: `'${root}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "files(id, name, webViewLink)",
      orderBy: "name",
      pageSize: 100,
    });

    // Đếm tài liệu trong từng lĩnh vực, chạy song song để một thư mục chậm
    // không giữ chân cả trang.
    const domains = await Promise.all(
      (folders.data.files ?? []).map(async (f) => {
        let documentCount = 0;
        try {
          // Đếm cả cây con: tài liệu thật nằm sâu ba cấp
          // (Finance / CFA / 6. Fixed Income / file.pdf), đếm con trực tiếp sẽ
          // ra 0 cho mọi lĩnh vực.
          documentCount = (await listFilesRecursive(drive, f.id!)).length;
        } catch {
          // Không đọc được một thư mục con thì vẫn hiện lĩnh vực đó, chỉ là
          // chưa biết số tài liệu.
        }
        return {
          id: f.id!,
          name: f.name || "(không tên)",
          webViewLink: f.webViewLink ?? null,
          documentCount,
        };
      })
    );

    return NextResponse.json({ success: true, domains });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được danh sách lĩnh vực";
    console.error("List domains error:", error);
    return NextResponse.json({ success: false, error: message, domains: [] }, { status: 500 });
  }
}

/** Thêm một lĩnh vực = tạo một thư mục con trong thư mục Knowledge. */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const { name } = await req.json();
    const cleaned = String(name ?? "").trim();

    if (!cleaned) {
      return NextResponse.json({ success: false, error: "Chưa nhập tên lĩnh vực" }, { status: 400 });
    }
    if (cleaned.length > 100 || /[\\/]/.test(cleaned)) {
      return NextResponse.json({ success: false, error: "Tên lĩnh vực không hợp lệ" }, { status: 400 });
    }

    const roots = knowledgeRoots();
    if (roots.length === 0) {
      return NextResponse.json({ success: false, error: "Chưa cấu hình thư mục Drive" }, { status: 503 });
    }

    const drive = driveClient();
    const root = roots[0];

    const existing = await drive.files.list({
      q: `'${root}' in parents and name = '${cleaned.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
      fields: "files(id)",
    });
    if (existing.data.files?.length) {
      return NextResponse.json({ success: false, error: "Lĩnh vực này đã có" }, { status: 409 });
    }

    const created = await drive.files.create({
      requestBody: { name: cleaned, mimeType: FOLDER_MIME, parents: [root] },
      fields: "id, name, webViewLink",
    });

    return NextResponse.json({
      success: true,
      domain: { id: created.data.id, name: created.data.name, webViewLink: created.data.webViewLink, documentCount: 0 },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không tạo được lĩnh vực";
    console.error("Create domain error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
