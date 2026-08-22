export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <h1 style={{ fontSize: 17 }}>この画面は見つかりませんでした</h1>
        <a
          href="/home"
          style={{ height: 34, padding: '0 15px', borderRadius: 8, border: '1px solid var(--line)', color: 'var(--t2)', display: 'inline-flex', alignItems: 'center' }}
        >
          ホームへ戻る
        </a>
      </div>
    </main>
  )
}
