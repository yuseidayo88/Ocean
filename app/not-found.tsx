import Link from 'next/link';

/** 見つからないときも、次にやることを書く。空のまま置かない */
export default function NotFound() {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, background: '#000', padding: 24,
    }}>
      <span style={{ fontSize: 15 }}>この行き先はありません。</span>
      <span style={{ color: '#8B8B8B', fontSize: 13, lineHeight: '21px' }}>
        消されたか、まだ作られていません。
      </span>
      <Link href="/home" style={{
        marginTop: 4, display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 16px',
        borderRadius: 8, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#B8B8B8',
      }}>ホームへ</Link>
    </div>
  );
}
