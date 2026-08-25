import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * メールのリンクと Google から帰ってくるところ。
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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const err = searchParams.get('error_description') ?? searchParams.get('error')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}/home`)
    return NextResponse.redirect(`${origin}/login?e=${why(error.message)}`)
  }
  return NextResponse.redirect(`${origin}/login${err ? `?e=${why(err)}` : ''}`)
}
