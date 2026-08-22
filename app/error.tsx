'use client';

/**
 * エラー画面。**失敗を隠さない。丸めない。謝らない。**
 * 何が起きて、何を変えれば進むかを書く（→ docs/design/07-executive-constitution.md）。
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, background: '#000', padding: 24,
    }}>
      <span style={{ color: '#F28B82', fontSize: 15 }}>この画面を出せませんでした。</span>
      <span style={{ color: '#8B8B8B', fontSize: 13, lineHeight: '21px', maxWidth: 460, textAlign: 'center' }}>
        作ったものは消えていません。もう一度ひらくか、左のレールから別の画面へ移ってください。
      </span>
      {error.digest && (
        <span style={{ color: '#3A3A3A', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{error.digest}</span>
      )}
      <button onClick={reset} style={{
        marginTop: 4, height: 34, padding: '0 16px', borderRadius: 8,
        background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#B8B8B8',
      }}>もう一度ひらく</button>
    </div>
  );
}
