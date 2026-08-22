import { createClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n'

/**
 * Phase 3 の完了条件 — ログインできて、自分のアカウントの空のホームが見える。
 * まだ Work は無い。**偽の中身を置かない。**
 */
export default async function Home() {
  const { t } = await getDict()
  let email: string | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    email = data.user?.email ?? null
  } catch {
    email = null   // Supabase 未設定のうちは素通し
  }

  return (
    <div style={S.shell}>
      <nav style={S.rail}>
        <div style={S.brand}>
          <span style={S.dots}><i style={S.d} /><i style={S.d} /><i style={S.d} /></span>
          <span style={{ color: 'var(--t4)', fontSize: 12 }}>{t.brand}</span>
        </div>
        <ul style={S.navList}>
          {[t.nav.home, t.nav.inbox, t.nav.work, t.nav.task, t.nav.deliverable, t.nav.member, t.nav.decision]
            .map((label, i) => (
              <li key={label} style={{ ...S.navRow, ...(i === 0 ? S.navRowOn : null) }}>{label}</li>
            ))}
        </ul>
        <div style={{ flex: 1 }} />
        <div style={S.me}>
          <span style={S.avatar}>{(email?.[0] ?? 'Y').toUpperCase()}</span>
          <span style={{ color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {email ?? 'あなた'}
          </span>
        </div>
      </nav>

      <main style={S.main}>
        <div style={S.center}>
          <h1 style={S.greeting}>{t.home.greeting}</h1>
          <div style={S.composer}>
            <span style={{ color: 'var(--t5)' }}>{t.home.emptyLead}</span>
            <div style={S.composerRow}>
              <span style={{ color: 'var(--t2)' }}>＋</span>
              <span style={{ color: 'var(--t2)' }}>{t.composer.executive}</span>
              <span style={{ color: 'var(--t2)' }}>{t.composer.auto}</span>
              <div style={{ flex: 1 }} />
              <span style={S.send}>↑</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', height: '100vh', background: 'var(--ground)' },
  rail: {
    width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14,
    padding: '14px 12px', background: 'var(--rail)', borderRight: '1px solid var(--line)',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, height: 26, padding: '0 4px' },
  dots: { display: 'inline-flex', gap: 6 },
  d: { width: 9, height: 9, borderRadius: 999, background: '#2E2E2E', display: 'inline-block' },
  navList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  navRow: { height: 34, display: 'flex', alignItems: 'center', padding: '0 10px', borderRadius: 'var(--r-row)', color: 'var(--t3)' },
  navRowOn: { background: '#1C1C1C', color: 'var(--t1)' },
  me: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px', minWidth: 0 },
  avatar: { width: 22, height: 22, borderRadius: 999, background: '#2E2E2E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 },
  main: { flex: 1, minWidth: 0, display: 'grid', placeItems: 'center', padding: 24 },
  center: { width: '100%', maxWidth: 748, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 },
  greeting: { fontSize: 26, lineHeight: '36px' },
  composer: {
    width: '100%', display: 'flex', flexDirection: 'column', gap: 11,
    padding: '12px 12px 10px', borderRadius: 'var(--r-composer)',
    background: 'var(--rail)', border: '1px solid #2A2A2A',
  },
  composerRow: { display: 'flex', alignItems: 'center', gap: 10 },
  send: { width: 34, height: 34, borderRadius: 999, background: 'var(--blue)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
}
