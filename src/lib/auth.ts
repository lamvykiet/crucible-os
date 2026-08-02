import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type AuthResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse };

/**
 * Xác thực request trong route handler.
 *
 * Dùng ở đầu mỗi route cần đăng nhập:
 *
 *   const { user, response } = await requireUser();
 *   if (!user) return response;
 *
 * TypeScript sẽ tự thu hẹp kiểu sau dòng `if`, nên `user` bên dưới luôn non-null.
 *
 * Luôn trả 401 dạng JSON — không bao giờ redirect. Route handler được gọi bằng
 * `fetch()` rồi `res.json()`, nên redirect sang trang login sẽ trả HTML và làm
 * client vỡ ở bước parse với thông báo lỗi không liên quan gì tới nguyên nhân thật.
 */
export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, response: null };
}
