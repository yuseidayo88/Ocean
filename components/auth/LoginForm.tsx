'use client'

import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Orb } from '@/components/ui/Orb'
import { RULES, passwordOk } from '@/lib/auth/password'
import { createClient } from '@/lib/supabase/client'
import { BLUE, EDGE, EXEC, GREEN_T, LINE, MUTE, RAIL, RED_T, T1, T4, T5, radius } from '@/lib/design/tokens'

/**
 * 入口の1枚。**入り方は2つ** — Google か、メールとパスワード。
 *
 * 参考（Mobbin）: Modal / Cursor / TIDAL / Hex / Resend。**どれも同じ形**だった —
 * 小さな顔 → 名前 → **外の入り口（Google）を上に** → `または` → メール → 送る。
 * 早い道を上に置き、遅い道を下に置く。
 *
 * **姿は3つ**（2026-08-25）。前は1つしか無く、**はじめての人と2回目の人が同じ画面**にいた:
 *   ・`login`  — ログイン。パスワードの右下に「パスワードを忘れた」
 *   ・`signup` — 新規登録。**決まりを満たすまで送れない**（満たしたところから緑になる）
 *   ・`forgot` — 再設定のリンクを送る。**ここだけ Google を出さない**
 *     （Google で入っている人にパスワードは無い。出すと道を間違わせる）
 * どの姿かは URL に持つ（`?mode=signup`）ので、リンクを渡せる。
 *
 * **メールのリンク（マジックリンク）は畳んだ。** 「忘れたときに届くメール」が
 * 再設定で足りるようになったので、メールで入る道が2本あることになっていた。
 *
 * この会社のデザイン言語に合わせたところ:
 *   ・**青は1ペインに1つ。** 青いのは送るボタンだけ。Google は枠だけのボタン
 *     （**Google 自身の暗い画面向けの作法**＝暗い面 ＋ 枠 ＋ 4色の G と同じ形）
 *   ・**面と枠を持てるのは押せるものだけ。** 顔・名前・`または`・決まりの行は素のまま
 *   ・4色の G は**色も形も変えない**（この画面でここだけが会社の色から外れる）
 *   ・**押せないものを押せる顔にしない** — 決まりを満たすまで送るボタンは灰色
 */

/** 前回どちらで入ったか。**この端末のブラウザにしか置かない** */
const LAST = 'onefound.last-login'

/** 統括AIの球の大きさ。社長が最初に見る顔なので、ここだけ大きい */
const ORB = 84

export type Mode = 'login' | 'signup' | 'forgot'

/** 入口の理由（`/auth/callback` が短い合図に畳んで返す） */
const WHY: Record<string, string> = {
  provider: 'Google での入り口は、まだ有効になっていません',
  link: 'リンクの期限が切れています。もう一度送ってください',
  denied: '入るのをやめました。もう一度どうぞ',
  unknown: '入れませんでした。もう一度お試しください',
}

/**
 * 上流の英語を、こちらの言葉に畳む。
 *
 * **「そのメールは登録されていません」とは言わない。** どのメールが登録済みかを
 * 外から数えられてしまう（メールアドレスの総当たり）。ログインが失敗したときは
 * いつも同じ1行にする。
 */
const say = (raw: string): string => {
  const s = raw.toLowerCase()
  if (s.includes('invalid login credentials')) return 'メールアドレスかパスワードが違います'
  if (s.includes('email not confirmed')) return 'メールの確認がまだです。届いているリンクを開いてください'
  if (s.includes('already registered')) return 'このメールでは作れませんでした。ログインをお試しください'
  if (s.includes('weak password') || s.includes('password should')) return 'パスワードが決まりを満たしていません'
  if (s.includes('rate limit') || s.includes('after')) return '少し時間をおいてから、もう一度お試しください'
  return 'うまくいきませんでした。もう一度お試しください'
}

const LEAD: Record<Mode, string> = {
  login: '一人社長のための AI カンパニー',
  signup: 'あなたの会社を作ります',
  forgot: 'パスワードを再設定します',
}

export function LoginForm({ why, mode: first = 'login' }: { why?: string; mode?: Mode }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(first)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  /** メールを送った先。空なら、まだ送っていない */
  const [sent, setSent] = useState<'' | 'signup' | 'forgot'>('')
  const [busy, setBusy] = useState<'' | 'google' | 'form'>('')
  /** 入力欄は**器のほうが応える**（`outline` を消しているので、枠で答える） */
  const [on, setOn] = useState('')
  const [fail, setFail] = useState(why ? (WHY[why] ?? WHY.unknown) : '')
  /**
   * 前回の入り方。**ブラウザにしか無い値**なので、サーバーでは null を返す
   * （描いたあとに1行が生えるのではなく、最初から正しい形で出る）。
   */
  const last = useSyncExternalStore(
    () => () => {},
    () => { try { return localStorage.getItem(LAST) } catch { return null } },
    () => null,
  )

  /**
   * 会社へ入る。**サーバー側にも新しいセッションで読み直させる**（`refresh`）—
   * 押さないと、器（レール・会社名）が入る前の姿のまま出ることがある。
   */
  const enter = () => { router.replace('/home'); router.refresh() }

  const remember = (how: 'google' | 'password') => {
    try { localStorage.setItem(LAST, how) } catch { /* 覚えられなくても入れる */ }
  }

  /** 姿を変える。**URL に持つ**が、`?` を書き換えるだけでサーバーには行かない */
  const go = (next: Mode) => {
    setMode(next); setFail(''); setSent(''); setPw('')
    try {
      window.history.replaceState(null, '', next === 'login' ? '/login' : `/login?mode=${next}`)
    } catch { /* 履歴に書けなくても画面は変わる */ }
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

  /** ログイン / 新規登録 / 再設定のリンク。**押せる形になってからしか呼ばれない** */
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return                       // 二度押しで2通送らない
    setBusy('form'); setFail('')
    const sb = createClient()
    try {
      if (mode === 'forgot') {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/callback?next=/auth/reset`,
        })
        if (error) throw error
        setSent('forgot')
        return
      }
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({
          email, password: pw,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        })
        if (error) throw error
        remember('password')
        /**
         * **確認メールが要るかどうかは、Supabase の設定で決まる。**
         * 要らない設定なら、この時点でもう入っている（`session` が返る）。
         * どちらでも正しく振る舞う — 画面が勝手に決めない。
         */
        if (data.session) { enter(); return }
        setSent('signup')
        return
      }
      const { error } = await sb.auth.signInWithPassword({ email, password: pw })
      if (error) throw error
      remember('password')
      enter()
    } catch (err) {
      setFail(say(err instanceof Error ? err.message : ''))
      setBusy('')
    }
  }

  /** 送れる形か。**押せないものを押せる顔にしない** */
  const ready = mode === 'forgot' ? !!email
    : mode === 'signup' ? !!email && passwordOk(pw)
    : !!email && !!pw

  const submitWord = busy === 'form' ? '送っています'
    : mode === 'forgot' ? '再設定のリンクを送る'
    : mode === 'signup' ? 'アカウントを作る' : 'ログイン'

  return (
    <main style={S.wrap}>
      <div className="rise" style={S.col}>
        <Orb color={EXEC} size={ORB} seed={7} />
        <h1 style={S.title}>OneFound</h1>

        {sent ? (
          /* 送ったあと。**やることは1つ**（受信箱を開く）ので、それだけを言う */
          <>
            <p style={S.lead}>メールを送りました</p>
            <p style={S.to}>{email}</p>
            <p style={S.note}>
              {sent === 'signup' ? 'リンクを開くと、この画面が会社になります'
                : 'リンクを開くと、新しいパスワードを決められます'}
            </p>
            <button className="lnk" onClick={() => { setSent(''); setFail('') }} style={S.again}>
              別のメールで送り直す
            </button>
          </>
        ) : (
          <>
            <p style={S.lead}>{LEAD[mode]}</p>

            <div style={S.stack}>
              {/* **外の入り口を上に。** 早い道が先（参考: Modal / Cursor / Hex）。
                  ただし再設定のときは出さない — Google の人にパスワードは無い */}
              {mode !== 'forgot' && (
                <>
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
                </>
              )}

              <form onSubmit={submit} style={S.form}>
                <input
                  type="email" required value={email} autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setOn('email')} onBlur={() => setOn('')}
                  placeholder="メールアドレス"
                  style={{ ...S.input, borderColor: on === 'email' ? BLUE : EDGE }}
                />

                {mode !== 'forgot' && (
                  <div style={{ position: 'relative', display: 'flex' }}>
                    <input
                      type={show ? 'text' : 'password'} required value={pw}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      onChange={(e) => setPw(e.target.value)}
                      onFocus={() => setOn('pw')} onBlur={() => setOn('')}
                      placeholder="パスワード"
                      style={{ ...S.input, flex: 1, paddingRight: 56, borderColor: on === 'pw' ? BLUE : EDGE }}
                    />
                    {/* 打ち間違いは、見えれば分かる。**アイコンを増やさず文字で言う** */}
                    <button type="button" className="lnk" onClick={() => setShow(!show)} style={S.peek}>
                      {show ? '隠す' : '表示'}
                    </button>
                  </div>
                )}

                {/* **決まりは満たしたところから緑になる。** 満たすまで送るボタンは灰色 */}
                {mode === 'signup' && (
                  <div style={S.rules}>
                    {RULES.map((r) => {
                      const met = r.ok(pw)
                      return (
                        <span key={r.key} style={{ ...S.ruleItem, color: met ? GREEN_T : T5 }}>
                          <Icon name="check" size={11} width={2} color={met ? GREEN_T : MUTE} />
                          {r.label}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* **青は1つだけ。** 決まりを満たすまで押せる顔をしない */}
                <button type="submit" disabled={!!busy || !ready}
                  className={busy || !ready ? undefined : 'solid'}
                  style={{
                    ...S.submit,
                    background: busy || !ready ? '#1B1B1B' : BLUE,
                    color: busy || !ready ? T5 : '#FFFFFF',
                    cursor: busy || !ready ? 'default' : 'pointer',
                  }}>
                  {submitWord}
                </button>
                {last === 'password' && mode === 'login' && <span style={S.last}>前回はこちらで入りました</span>}
              </form>
            </div>

            {/* 行き先。**押せる顔をしていて何も起きないものは置かない** */}
            <div style={S.foot}>
              {mode === 'login' && (
                <>
                  <button className="lnk" onClick={() => go('forgot')} style={S.footLink}>
                    パスワードを忘れた
                  </button>
                  <span style={S.footNote}>
                    アカウントがまだなら{' '}
                    <button className="lnk" onClick={() => go('signup')} style={S.footStrong}>新規登録</button>
                  </span>
                </>
              )}
              {mode === 'signup' && (
                <span style={S.footNote}>
                  アカウントをお持ちなら{' '}
                  <button className="lnk" onClick={() => go('login')} style={S.footStrong}>ログイン</button>
                </span>
              )}
              {mode === 'forgot' && (
                <button className="lnk" onClick={() => go('login')} style={S.footLink}>ログインに戻る</button>
              )}
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
 * **入力欄とボタンは同じ角丸**（14）。縦に積んだものは1つのまとまりとして読むので、
 * ここだけ「ボタンは 8」から外す（積んだときに段違いに見えるほうが目に付く）。
 */
export const S: Record<string, React.CSSProperties> = {
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
  /** 入力欄の中に浮かせる。**面も枠も持たない**（文字が明るくなるだけ） */
  peek: {
    position: 'absolute', right: 1, top: 1, bottom: 1, width: 52,
    background: 'none', color: T5, fontSize: 12, borderRadius: radius.input,
  },
  /** 決まりの行。**枠で囲わない**（読むだけのもの） */
  rules: { display: 'flex', flexWrap: 'wrap', gap: '5px 12px', padding: '3px 2px 1px' },
  ruleItem: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5 },
  submit: {
    height: 44, borderRadius: radius.input, fontSize: 13.5, marginTop: 2,
    transition: 'background-color .14s ease, color .14s ease',
  },
  /** 前回の入り方。思い出させるためだけの1行なので、いちばん沈める */
  last: { color: T5, fontSize: 11.5, textAlign: 'center', paddingTop: 8 },
  foot: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    width: '100%', marginTop: 20,
  },
  footLink: { color: T4, fontSize: 12.5, background: 'none' },
  footNote: { color: T5, fontSize: 12.5 },
  footStrong: { color: T4, fontSize: 12.5, background: 'none' },
  to: { color: T1, fontSize: 13.5, margin: '8px 0 0' },
  note: { color: T5, fontSize: 12, margin: '10px 0 0' },
  again: { color: T4, fontSize: 12.5, marginTop: 18, background: 'none' },
  fail: { color: RED_T, fontSize: 12, textAlign: 'center', marginTop: 16, maxWidth: 300 },
}
