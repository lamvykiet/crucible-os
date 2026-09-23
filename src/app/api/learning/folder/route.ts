import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  driveClient, knowledgeRoots, listFilesRecursive, FOLDER_MIME,
} from "@/lib/driveAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lần ngược tối đa bấy nhiêu tầng khi dựng đường dẫn — chặn vòng lặp vô hạn. */
const MAX_DEPTH = 8;

/**
 * Một thư mục trong cây học tập, kèm đường dẫn và các thư mục con.
 *
 * Cây của người dùng có độ sâu KHÔNG đồng nhất:
 *
 *   Finance ▸ CFA ▸ 1. Quantitative Methods ▸ tài liệu     (3 tầng)
 *   Language ▸ IELTS                                        (2 tầng, chưa có con)
 *   3D Design ▸ tài liệu                                    (1 tầng)
 *
 * Nên API này không giả định "nhóm / lớp / môn" là ba tầng cố định. Nó chỉ trả
 * lời đúng một câu: thư mục này có con không, và đứng ở đâu trong cây. Giao
 * diện tự quyết hiện danh sách con hay hiện bàn học.
 *
 * Dựng cứng ba tầng sẽ vỡ ngay ở 3D Design, và cũng chặn luôn việc người dùng
 * chia sâu thêm về sau.
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  try {
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ success: false, error: "Thiếu id thư mục" }, { status: 400 });
    }

    const roots = knowledgeRoots();
    if (roots.length === 0) {
      return NextResponse.json(
        { success: false, error: "Chưa cấu hình thư mục Drive" },
        { status: 503 }
      );
    }

    const drive = driveClient();

    const self = await drive.files.get({
      fileId: id,
      fields: "id, name, mimeType, parents, webViewLink",
    });

    if (self.data.mimeType !== FOLDER_MIME) {
      return NextResponse.json({ success: false, error: "Đây không phải thư mục" }, { status: 400 });
    }

    // Lần ngược lên gốc để dựng đường dẫn. Đồng thời đây chính là phép kiểm
    // quyền: thư mục nào không nằm dưới gốc Knowledge thì từ chối, kể cả khi
    // tài khoản Drive dùng chung vẫn với tới được.
    const trail: { id: string; name: string }[] = [];
    let cursor = self.data.parents?.[0];
    let withinRoot = roots.includes(id);

    for (let i = 0; cursor && i < MAX_DEPTH; i++) {
      if (roots.includes(cursor)) {
        withinRoot = true;
        break;
      }
      const parent = await drive.files.get({ fileId: cursor, fields: "id, name, parents" });
      trail.unshift({ id: parent.data.id!, name: parent.data.name || "(không tên)" });
      cursor = parent.data.parents?.[0];
    }

    if (!withinRoot) {
      return NextResponse.json(
        { success: false, error: "Thư mục nằm ngoài phạm vi học tập" },
        { status: 403 }
      );
    }

    const listing = await drive.files.list({
      q: `'${id}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, webViewLink)",
      orderBy: "folder,name",
      pageSize: 200,
    });

    const all = listing.data.files ?? [];
    const folders = all.filter((f) => f.mimeType === FOLDER_MIME);

    // Đếm tài liệu của từng thư mục con, chạy song song để một nhánh chậm không
    // giữ chân cả trang. Đếm cả cây con vì tài liệu thật hay nằm sâu vài tầng.
    const children = await Promise.all(
      folders.map(async (f) => {
        let documentCount = 0;
        let childFolderCount = 0;
        try {
          documentCount = (await listFilesRecursive(drive, f.id!)).length;
          const sub = await drive.files.list({
            q: `'${f.id}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
            fields: "files(id)",
            pageSize: 100,
          });
          childFolderCount = (sub.data.files ?? []).length;
        } catch {
          // Không đọc được một nhánh thì vẫn hiện nhánh đó, chỉ là chưa biết số.
        }
        return {
          id: f.id!,
          name: f.name || "(không tên)",
          webViewLink: f.webViewLink ?? null,
          documentCount,
          childFolderCount,
        };
      })
    );

    return NextResponse.json({
      success: true,
      folder: {
        id: self.data.id!,
        name: self.data.name || "(không tên)",
        webViewLink: self.data.webViewLink ?? null,
      },
      /** Từ nhóm ngoài cùng vào tới thư mục cha trực tiếp. */
      breadcrumb: trail,
      children,
      /** Tài liệu nằm trực tiếp trong thư mục này, không tính cây con. */
      documentCount: all.length - folders.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không đọc được thư mục";
    console.error("Learning folder error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
