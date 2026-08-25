import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Google と、メールのリンク（確認・再設定）から帰ってくるところ。
 *
 * **黙って入口に戻さない。** 前は理由を捨てて `/login` に返していたので、
 * リンクの期限切れも、有効になっていない入り口も、画面上は同じ「何も起きない」だった。
 * 短い合図（`?e=`）に畳んで渡し、入口の画面が日本語1行にする。
 *
 * 上流の文言はそのまま出さない（英語のうえ、外から来た文字なので）。
 * ここで**知っているものだけ**に畳む。
 */
const why = (raw: string): string => {
  const s = raw.toLowerCase()
  if (s.includes('provider') && (s.includes('not enabled') || s.includes('unsupported'))) return 'provider'
  if (s.includes('expired') || s.includes('otp_expired') || s.includes('invalid')) return 'link'
  if (s.includes('access_denied') || s.includes('cancel')) return 'denied'
  return 'unknown'
}

/**
 * 引き換えたあとの行き先。**外のサイトへは絶対に飛ばさない。**
 *
 * `?next=` をそのまま `redirect` に渡すと、`https://…` や `//evil.example` を
 * 入れられて**このアプリの名前で他所へ送れる**（オープンリダイレクト）。
 * ログイン直後の遷移は疑われにくいぶん、いちばん効いてしまう場所でもある。
 * だから**この形だけを通す** — `/` で始まり、`//` でも `/\` でもない、素の path。
 */
const NEXT = /^\/(?![/\\])[A-Za-z0-9\-._~/]*$/
const safeNext = (raw: string | null) => (raw && NEXT.test(raw) ? raw : '/home')

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const err = searchParams.get('error_description') ?? searchParams.get('error')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${safeNext(searchParams.get('next'))}`)
    return NextResponse.redirect(`${origin}/login?e=${why(error.message)}`)
  }
  return NextResponse.redirect(`${origin}/login${err ? `?e=${why(err)}` : ''}`)
}
