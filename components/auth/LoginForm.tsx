'use client'

import { useState, useSyncExternalStore } from 'react'
import { Orb } from '@/components/ui/Orb'
import { createClient } from '@/lib/supabase/client'
import { BLUE, EDGE, EXEC, LINE, RAIL, RED_T, T1, T4, T5, radius } from '@/lib/design/tokens'

/**
 * 入口の1枚。**パスワードは持たない** — Google か、メールのリンクか。
 *
 * 参考（Mobbin）: Modal / Cursor / TIDAL / Hex / Resend。**どれも同じ形**だった —
 * 小さな顔 → 名前 → **外の入り口（Google）を上に** → `または` → メール → 送る。
 * 早い道を上に置き、遅い道（受信箱を開きに行く）を下に置く。
 *
 * この会社のデザイン言語に合わせたところ:
 *   ・**青は1ペインに1つ。** 青いのは「リンクを送る」だけ。
 *     Google は枠だけのボタンにする — これは妥協ではなく、
 *     **Google 自身の暗い画面向けの作法**（暗い面 ＋ 枠 ＋ 4色の G）と同じ形
 *   ・**面と枠を持てるのは押せるものだけ。** 顔・名前・`または` は素のまま
 *   ・**操作説明のコピーを置かない。** 「メールを確認してください」は送ったあとにだけ言う
 *   ・4色の G は**色を変えない**（Google の決まり。ここだけは会社の色ではない）
 *
 * **前回の入り方を覚えておく**（参考: Modal の "You last logged in with Google"）。
 * 2回目からは、どっちで入ったか思い出さなくていい。ブラウザの中だけに持つ。
 */

/** 前回どちらで入ったか。**この端末のブラウザにしか置かない** */
const LAST = 'onefound.last-login'

/** 統括AIの球の大きさ。社長が最初に見る顔なので、ここだけ大きい */
const ORB = 84

/** 入口の理由（`/auth/callback` が短い合図に畳んで返す） */
const WHY: Record<string, string> = {
  provider: 'Google での入り口は、まだ有効になっていません',
  link: 'リンクの期限が切れています。もう一度送ってください',
  denied: '入るのをやめました。もう一度どうぞ',
  unknown: '入れませんでした。もう一度お試しください',
}

export function LoginForm({ why }: { why?: string }) {
  const [email, setEmail] = useState('')
  /** 送った先。空なら、まだ送っていない */
  const [sent, setSent] = useState('')
  const [busy, setBusy] = useState<'' | 'google' | 'email'>('')
  /** 入力欄は**器のほうが応える**（`outline` を消しているので、枠で答える） */
  const [onEmail, setOnEmail] = useState(false)
  const [fail, setFail] = useState(why ? (WHY[why] ?? WHY.unknown) : '')
  /**
   * 前回の入り方。**ブラウザにしか無い値**なので、サーバーでは null を返す
   * （描いたあとに1行が生えるのではなく、最初から正しい形で出る）。
   * 途中で変わるものではないので、購読はしない。
   */
  const last = useSyncExternalStore(
    () => () => {},
    () => { try { return localStorage.getItem(LAST) } catch { return null } },
    () => null,
  )

  const remember = (how: 'google' | 'email') => {
    try { localStorage.setItem(LAST, how) } catch { /* 覚えられなくても入れる */ }
  }

  async function google() {
    setBusy('google'); setFail('')
    try {
      remember('google')
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/auth/callback` },
      })
      // ここまで来たら画面は Google へ移る。移らなかったときだけ理由を出す
      if (error) throw error
    } catch {
      setBusy(''); setFail(WHY.unknown)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy('email'); setFail('')
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      })
      if (error) throw error
      remember('email')
      setSent(email)
    } catch {
      setFail('送れませんでした。もう一度お試しください')
    } finally {
      setBusy('')
    }
  }

  return (
    <main style={S.wrap}>
      <div className="rise" style={S.col}>
        <Orb color={EXEC} size={ORB} seed={7} />
        <h1 style={S.title}>OneFound</h1>

        {sent ? (
          /* 送ったあと。**やることは1つ**（受信箱を開く）ので、それだけを言う */
          <>
            <p style={S.lead}>メールを送りました</p>
            <p style={S.to}>{sent}</p>
            <p style={S.note}>リンクを開くと、この画面が会社になります</p>
            <button className="lnk" onClick={() => { setSent(''); setFail('') }} style={S.again}>
              別のメールで送り直す
            </button>
          </>
        ) : (
          <>
            <p style={S.lead}>一人社長のための AI カンパニー</p>

            <div style={S.stack}>
              {/* **外の入り口を上に。** 早い道が先（参考: Modal / Cursor / Hex） */}
              <button onClick={google} disabled={!!busy} className="btn" style={S.oauth}>
                <GoogleMark />
                <span>{busy === 'google' ? 'Google に移っています' : 'Google で続ける'}</span>
              </button>
              {last === 'google' && <span style={S.last}>前回はこちらで入りました</span>}

              <div style={S.orRow}>
                <span style={S.rule} />
                <span style={S.or}>または</span>
                <span style={S.rule} />
              </div>

              <form onSubmit={send} style={S.form}>
                <input
                  type="email" required value={email} autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setOnEmail(true)} onBlur={() => setOnEmail(false)}
                  placeholder="メールアドレス"
                  style={{ ...S.input, borderColor: onEmail ? BLUE : EDGE }}
                />
                {/* **青は1つだけ。** 書いていないときは押せる顔をしない */}
                <button type="submit" disabled={!!busy || !email}
                  className={busy || !email ? undefined : 'solid'}
                  style={{
                    ...S.submit,
                    background: busy || !email ? '#1B1B1B' : BLUE,
                    color: busy || !email ? T5 : '#FFFFFF',
                    cursor: busy || !email ? 'default' : 'pointer',
                  }}>
                  {busy === 'email' ? '送っています' : 'ログインのリンクを送る'}
                </button>
                {last === 'email' && <span style={S.last}>前回はこちらで入りました</span>}
              </form>
            </div>
          </>
        )}

        {/* 倒れたら理由を出す（黙って終わらせない） */}
        {fail && <span style={S.fail}>{fail}</span>}
      </div>
    </main>
  )
}

/**
 * Google の G。**色も形も変えない**（Google の決まり）。
 * この画面でここだけが会社の色から外れる — だから、ほかは徹底して素にしてある。
 */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2582h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.6151z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2582c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z" />
      <path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5814-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z" />
    </svg>
  )
}

/**
 * **入力欄とボタンは同じ角丸**（14）。縦に積んだ3つは1つのまとまりとして読むので、
 * ここだけ「ボタンは 8」から外す（積んだときに段違いに見えるほうが目に付く）。
 */
const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 },
  col: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    width: '100%', maxWidth: 340,
  },
  title: { fontSize: 22, lineHeight: '30px', margin: '14px 0 0' },
  lead: { color: T4, fontSize: 13, margin: '6px 0 0' },
  stack: { display: 'flex', flexDirection: 'column', width: '100%', marginTop: 26 },
  oauth: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', height: 44, borderRadius: radius.input,
    background: '#0E0E0E', border: `1px solid ${EDGE}`, color: T1, fontSize: 13.5,
  },
  orRow: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', margin: '18px 0' },
  rule: { flex: 1, height: 1, background: LINE },
  or: { color: T5, fontSize: 11.5 },
  form: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  input: {
    height: 44, padding: '0 14px', borderRadius: radius.input,
    background: RAIL, border: `1px solid ${EDGE}`, outline: 'none', fontSize: 13.5,
    transition: 'border-color .12s ease',
  },
  submit: {
    height: 44, borderRadius: radius.input, fontSize: 13.5,
    transition: 'background-color .14s ease, color .14s ease',
  },
  /** 前回の入り方。思い出させるためだけの1行なので、いちばん沈める */
  last: { color: T5, fontSize: 11.5, textAlign: 'center', paddingTop: 8 },
  to: { color: T1, fontSize: 13.5, margin: '8px 0 0' },
  note: { color: T5, fontSize: 12, margin: '10px 0 0' },
  again: { color: T4, fontSize: 12.5, marginTop: 18, background: 'none' },
  fail: { color: RED_T, fontSize: 12, textAlign: 'center', marginTop: 16, maxWidth: 300 },
}
