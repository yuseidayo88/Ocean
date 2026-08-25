'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Orb } from '@/components/ui/Orb'
import { S } from '@/components/auth/LoginForm'
import { RULES, passwordOk } from '@/lib/auth/password'
import { createClient } from '@/lib/supabase/client'
import { BLUE, EDGE, EXEC, GREEN_T, MUTE, RED_T, T4, T5 } from '@/lib/design/tokens'

/**
 * 新しいパスワードを決める。**入口の1枚と同じ器**（`S` を借りる）—
 * ここだけ別の見た目にすると、同じ流れの途中で別のアプリに来たように見える。
 *
 * **リンクを踏んでいない人はここで決められない。** 再設定のリンクは
 * `/auth/callback` でセッションに引き換わるので、それが無ければ
 * 「リンクから開いてください」と正直に言い、入口へ戻す道を置く。
 *
 * **2回打たせる。** 見えない文字を1回で決めさせると、打ち間違えたまま
 * 締め出される（次に入れるのは、また再設定のメールを送ってから）。
 */
/** 認証の相手がいるか。`NEXT_PUBLIC_` は組み立てのときに焼き込まれる */
const CAN = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export function ResetForm() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [on, setOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [fail, setFail] = useState('')
  /** リンクから来ているか。**分かるまで押させない**（'?' のあいだは読み込み中）。
      保存先が設定されていない配り方（デモ）では最初から 'no' — 白い画面より正直 */
  const [live, setLive] = useState<'?' | 'yes' | 'no'>(CAN ? '?' : 'no')

  useEffect(() => {
    if (!CAN) return
    let alive = true
    createClient().auth.getSession().then(
      ({ data }) => { if (alive) setLive(data.session ? 'yes' : 'no') },
      () => { if (alive) setLive('no') },
    )
    return () => { alive = false }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setFail('')
    try {
      const { error } = await createClient().auth.updateUser({ password: pw })
      if (error) throw error
      router.replace('/home'); router.refresh()
    } catch (err) {
      const m = (err instanceof Error ? err.message : '').toLowerCase()
      setFail(m.includes('should') || m.includes('weak')
        ? 'パスワードが決まりを満たしていません'
        : m.includes('same')
          ? 'いまと同じパスワードです。別のものにしてください'
          : '変えられませんでした。リンクから開き直してください')
      setBusy(false)
    }
  }

  const match = !!again && pw === again
  const ready = passwordOk(pw) && match

  return (
    <main style={S.wrap}>
      <div className="rise" style={S.col}>
        <Orb color={EXEC} size={84} seed={7} />
        <h1 style={S.title}>OneFound</h1>

        {live === 'no' ? (
          <>
            <p style={S.lead}>このリンクからは決められません</p>
            <p style={S.note}>期限が切れているか、一度使われています</p>
            <a href="/login?mode=forgot" className="lnk" style={{ ...S.again, textDecoration: 'none' }}>
              もう一度リンクを送る
            </a>
          </>
        ) : (
          <>
            <p style={S.lead}>新しいパスワードを決めます</p>
            <div style={S.stack}>
              <form onSubmit={submit} style={S.form}>
                <div style={{ position: 'relative', display: 'flex' }}>
                  <input
                    type={show ? 'text' : 'password'} required value={pw} autoComplete="new-password"
                    onChange={(e) => setPw(e.target.value)}
                    onFocus={() => setOn('pw')} onBlur={() => setOn('')}
                    placeholder="新しいパスワード"
                    style={{ ...S.input, flex: 1, paddingRight: 56, borderColor: on === 'pw' ? BLUE : EDGE }}
                  />
                  <button type="button" className="lnk" onClick={() => setShow(!show)} style={S.peek}>
                    {show ? '隠す' : '表示'}
                  </button>
                </div>

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

                <input
                  type={show ? 'text' : 'password'} required value={again} autoComplete="new-password"
                  onChange={(e) => setAgain(e.target.value)}
                  onFocus={() => setOn('again')} onBlur={() => setOn('')}
                  placeholder="もう一度"
                  style={{ ...S.input, borderColor: on === 'again' ? BLUE : EDGE }}
                />
                {/* **違っていることは、送る前に言う**（押してから怒らない） */}
                {!!again && !match && <span style={{ color: T5, fontSize: 11.5, padding: '0 2px' }}>2つが違います</span>}

                <button type="submit" disabled={busy || !ready || live !== 'yes'}
                  className={busy || !ready || live !== 'yes' ? undefined : 'solid'}
                  style={{
                    ...S.submit,
                    background: busy || !ready || live !== 'yes' ? '#1B1B1B' : BLUE,
                    color: busy || !ready || live !== 'yes' ? T5 : '#FFFFFF',
                    cursor: busy || !ready || live !== 'yes' ? 'default' : 'pointer',
                  }}>
                  {busy ? '変えています' : 'このパスワードにする'}
                </button>
              </form>
            </div>
            <div style={S.foot}>
              <a href="/login" className="lnk" style={{ ...S.footLink, textDecoration: 'none', color: T4 }}>
                ログインに戻る
              </a>
            </div>
          </>
        )}

        {fail && <span style={{ ...S.fail, color: RED_T }}>{fail}</span>}
      </div>
    </main>
  )
}
