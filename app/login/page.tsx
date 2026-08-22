'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** メールのリンクだけでログインする。パスワードは持たない */
export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setFailed(false)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      })
      if (error) throw error
      setSent(true)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={S.wrap}>
      <div style={S.col}>
        <div style={S.orb} />
        <h1 style={S.title}>OneFound</h1>
        <p style={S.lead}>一人社長のための AI カンパニー。</p>

        {sent ? (
          <p style={S.sent}>メールを見てください。リンクを開くと入れます。</p>
        ) : (
          <form onSubmit={send} style={S.form}>
            <input
              type="email" required value={email} autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス" style={S.input}
            />
            <button type="submit" disabled={busy || !email} style={{ ...S.submit, opacity: busy || !email ? 0.5 : 1 }}>
              ログインのリンクを送る
            </button>
            {failed && <span style={S.failed}>送れませんでした。もう一度お試しください。</span>}
          </form>
        )}
      </div>
    </main>
  )
}

const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 },
  col: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', maxWidth: 360 },
  orb: {
    width: 96, height: 96, borderRadius: 999, marginBottom: 8,
    background: 'radial-gradient(circle at 46% 38%, rgba(255,255,255,0.22), rgba(255,255,255,0) 72%)',
    border: '1px solid #2A2A2A',
  },
  title: { fontSize: 22 },
  lead: { color: 'var(--t4)', margin: 0, marginBottom: 14 },
  form: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  input: {
    height: 42, padding: '0 14px', borderRadius: 'var(--r-input)',
    background: 'var(--rail)', border: '1px solid #2A2A2A', outline: 'none',
  },
  submit: { height: 42, borderRadius: 'var(--r-input)', background: 'var(--blue)', color: '#FFFFFF' },
  sent: { color: 'var(--t2)', textAlign: 'center', lineHeight: '22px' },
  failed: { color: 'var(--red-t)', fontSize: 12 },
}
