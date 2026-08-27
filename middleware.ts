import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * `/api/cron` は cookie を持たない（Vercel Cron が呼ぶ）ので、ここで弾くと
 * **ログイン画面へのリダイレクトを毎時受け取るだけ**になる。
 * 素通しにするが**開いてはいない** — route 側が `CRON_SECRET` で断る。
 */
/**
 * `/p` は**公開したページ**（2026-08-27）。社長が押したものだけがここに出る
 * （→ `supabase/migrations/0038_published_pages.sql`）。
 * ログインを求めたら、公開した意味が無い。
 */
const PUBLIC = ['/login', '/auth', '/api/health', '/api/cron', '/p/', '/_next', '/favicon.ico']
const isPublic = (r: NextRequest) => PUBLIC.some((p) => r.nextUrl.pathname.startsWith(p))

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
  // 未設定のうちは素通し（Phase 3 の途中でも画面が見られるように）。
  // **本番では素通ししない。** 設定漏れで全部が開くほうが危ない
  if (!url || !key) {
    if (process.env.APP_ENV !== 'production') return response
    return isPublic(request) ? response : NextResponse.redirect(new URL('/login', request.url))
  }

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

  // **`getUser()` を使わない。**
  // getUser() は毎回 Supabase の認証サーバーに問い合わせに行く。middleware は
  // 画面の移動だけでなく、先読み（prefetch）の1本1本にも走るので、
  // 1画面ひらくだけで往復が数十回になる。そのぶんが丸ごと待ち時間になる。
  // getClaims() は署名鍵を1度だけ取って**手もとで JWT を検証する**ので、往復が要らない。
  // （鍵が共有鍵のままの間は内部で問い合わせに落ちる。非対称鍵に切り替えると効く）
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims && !isPublic(request)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  /**
   * **入っている人に入口を見せない。** 前は `/login` が誰にでも開いたので、
   * 入ったあとに戻るを押すと、もう会社にいるのに「ログイン」の画面が出た。
   * `/auth/*` は素通しのまま — **再設定はセッションを持ったまま開く**画面なので、
   * ここで弾くと自分のパスワードを変えられなくなる。
   */
  if (claims && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/home', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
