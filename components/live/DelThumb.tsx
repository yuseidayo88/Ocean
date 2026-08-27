import { MUTE, RAIL } from '@/lib/design/tokens';

/**
 * 成果物のサムネイル＝**実際の書き出し**（灰色の棒を置かない）。
 *
 * **1か所にする**（2026-08-27）。成果物の画面はこれを持っていたのに、
 * **Work 画面だけが灰色の棒3本**を描いていた — 同じ Work の成果物が2枚並ぶと、
 * どちらも同じ絵で、開くまで見分けられない。
 * 見分けるための面なので、中身に使う。
 */
export function DelThumb({ preview, height = 108 }: { preview?: string; height?: number }) {
  // 形によって書き出しの割れ方が違う（表は行、文章は文）。**行が先** — 表を1行に潰さない
  // **箇条書きは割らない**（`・` の行を「。」で切ると、2行めから印が消える）
  const lines = (preview ?? '').split('\n')
    .flatMap((l) => (l.trimStart().startsWith('・') ? [l] : l.split(/(?<=。)/)))
    .filter((l) => l.trim()).slice(0, height >= 108 ? 4 : 3);
  return (
    <div style={{
      height, boxSizing: 'border-box', borderRadius: 8, background: RAIL,
      padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 5, overflow: 'hidden',
    }}>
      {lines.length === 0 && <span style={{ color: MUTE, fontSize: 10 }}>書き出しはありません</span>}
      {lines.map((l, i) => (
        <span key={i} style={{ color: '#5A5A5A', fontSize: 10, lineHeight: '15px' }}>{l}</span>
      ))}
    </div>
  );
}
