'use client'

/** 失敗したら、失敗したと出す。それらしい画面でごまかさない */
export default function ErrorScreen({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={S.wrap}>
      <div style={S.box}>
        <span style={S.dot} />
        <h1 style={S.title}>うまくいきませんでした</h1>
        <div style={S.actions}>
          <button onClick={reset} style={S.primary}>もう一度</button>
          <a href="/home" style={S.ghost}>ホームへ戻る</a>
        </div>
      </div>
    </main>
  )
}

const S: Record<string, React.CSSProperties> = {
  wrap: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 },
  box: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  dot: { width: 9, height: 9, borderRadius: 999, background: 'var(--red)' },
  title: { fontSize: 17 },
  actions: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 },
  primary: { height: 34, padding: '0 15px', borderRadius: 'var(--r-row)', background: 'var(--blue)', color: '#FFFFFF' },
  ghost: { height: 34, padding: '0 15px', borderRadius: 'var(--r-row)', border: '1px solid var(--line)', color: 'var(--t2)', display: 'inline-flex', alignItems: 'center' },
}
