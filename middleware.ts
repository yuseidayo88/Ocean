import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC = ['/login', '/auth', '/api/health', '/_next', '/favicon.ico']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Phase 4 のダミーデータ表示モード。ログインを通さずに全画面を触れるようにする。
  // 中身はダミーで、書き込みはどこにも届かない。
  //   ・NEXT_PUBLIC_ を付けない = クライアントに配らず、Worker の env から実行時に読む
  //   ・**.env* には書かない。** OpenNext が .env* を既定値として焼き込むので本番にも付いていく
  //   ・それでも紛れ込んだときのために、APP_ENV=production では効かないようにしてある
  if (process.env.DEMO_MODE === '1' && process.env.APP_ENV !== 'production') return response

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // 未設定のうちは素通し（Phase 3 の途中でも画面が見られるように）
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of list) response.cookies.set(name, value, options)
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  if (!user && !PUBLIC.some((p) => path.startsWith(p))) {
    const to = request.nextUrl.clone()
    to.pathname = '/login'
    return NextResponse.redirect(to)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
