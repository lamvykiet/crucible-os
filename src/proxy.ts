import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16 đổi tên convention `middleware` thành `proxy`.
// Xem node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md (mục
// "middleware to proxy"). Runtime là nodejs và không cấu hình được.

// Đường dẫn công khai, không cần đăng nhập.
const PUBLIC_PATHS = ['/login', '/auth']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Cookie phía request không mang thuộc tính nên chỉ cần name/value;
          // `options` được áp ở phía response bên dưới. Đây là pattern chính
          // thức của @supabase/ssr, đừng "sửa" thành truyền options ở cả hai chỗ.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublic(pathname)) {
    // Route handler được gọi bằng fetch() rồi res.json(). Redirect 307 sang
    // /login sẽ trả về HTML, khiến client vỡ ở bước parse JSON với một thông
    // báo lỗi chẳng liên quan gì tới nguyên nhân thật (chưa đăng nhập).
    // Trả 401 JSON để client xử lý được đúng.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Giữ lại đích đến để đăng nhập xong quay lại đúng chỗ.
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
