import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { driveOAuthClient } from "@/lib/videoLibrary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Phát video ngay trong app, không phải nhảy sang Google Drive.
 *
 * Không thể trỏ thẳng `<video src>` vào Drive: file nằm trong một tài khoản
 * Drive dùng chung mà trình duyệt người dùng không đăng nhập, nên cả
 * `webContentLink` lẫn iframe `/preview` đều trả về trang đòi đăng nhập. Route
 * này mượn quyền của server rồi đẩy luồng byte về cho thẻ `<video>`.
 *
 * Phần quan trọng nhất là **Range**: thiếu nó thì trình duyệt phải tải hết file
 * mới phát được và thanh tua trở thành đồ trang trí. Header `Range` của trình
 * duyệt được chuyển nguyên si lên Drive và mã 206 cùng `Content-Range` được trả
 * nguyên si về.
 */

/** Header cần giữ nguyên từ Drive để trình duyệt tua được. */
const PASSTHROUGH = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "etag",
  "last-modified",
] as const;

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const fileId = new URL(req.url).searchParams.get("id");
  if (!fileId) {
    return NextResponse.json({ success: false, error: "Thiếu id" }, { status: 400 });
  }

  // Refresh token của Drive là dùng chung cho cả hệ thống, nên nếu chỉ kiểm tra
  // "đã đăng nhập chưa" thì bất kỳ fileId nào tài khoản đó với tới được cũng
  // phát ra được — kể cả ảnh hoá đơn hay tài liệu riêng. Chỉ cho phát file đã
  // nằm trong thư viện video của chính người đang xem.
  const owned = await prisma.videoItem.findFirst({
    where: { userId: user.id, driveFileId: fileId },
    select: { id: true },
  });
  if (!owned) {
    // 404 chứ không phải 403: đừng xác nhận cho người gọi biết fileId có tồn tại.
    return NextResponse.json({ success: false, error: "Không tìm thấy" }, { status: 404 });
  }

  try {
    const token = (await driveOAuthClient().getAccessToken()).token;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Không lấy được quyền truy cập Drive" },
        { status: 502 }
      );
    }

    const range = req.headers.get("range");
    const upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(range ? { Range: range } : {}),
        },
      }
    );

    if (!upstream.ok && upstream.status !== 206) {
      console.error("Video stream: Drive trả", upstream.status, await upstream.text());
      return NextResponse.json(
        { success: false, error: "Không đọc được video từ Drive" },
        { status: upstream.status === 404 ? 404 : 502 }
      );
    }

    const headers = new Headers();
    for (const name of PASSTHROUGH) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    // Drive không phải lúc nào cũng nói, nhưng nó luôn nhận Range — báo cho
    // trình duyệt biết để nó chịu tua thay vì tải tuần tự từ đầu.
    if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
    // Video riêng tư: không cho CDN dùng chung bộ nhớ đệm.
    headers.set("cache-control", "private, max-age=300");

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error("Video stream error:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}
