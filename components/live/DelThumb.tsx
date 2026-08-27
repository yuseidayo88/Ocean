import { formatOf } from '@/lib/deliver/format';
import { MUTE, RAIL } from '@/lib/design/tokens';

/**
 * 成果物のサムネイル＝**実際の書き出し**（灰色の棒を置かない）。
 *
 * **1か所にする**（2026-08-27）。成果物の画面はこれを持っていたのに、
 * **Work 画面だけが灰色の棒3本**を描いていた — 同じ Work の成果物が2枚並ぶと、
 * どちらも同じ絵で、開くまで見分けられない。
 * 見分けるための面なので、中身に使う。
 */
export function DelThumb({ preview, src, kind, height = 108 }: {
  preview?: string; src?: string; kind?: string; height?: number;
}) {
  /**
   * **絵は絵で見分ける**（2026-08-27）。画像の成果物には書き出しが無いので、
   * 文字を出すところが無い — 縮めた絵そのものがサムネイルになる。
   * **白い面に置く**（ロゴは白背景で作られることが多く、黒の上だと消える）。
   */
  /**
   * **`src` があるかどうかで決めない**（2026-08-27）。音声も同じ列に道を持つので、
   * それだけで見分けると **mp3 を `<img>` に渡して壊れた絵**が出る。
   * 形で決める — 音声のサムネイルは**台本の書き出し**（聞く前に中身が分かる）。
   */
  if (src && formatOf(kind, preview ?? '').shape === 'image') {
    return (
      <div style={{
        height, boxSizing: 'border-box', borderRadius: 8, background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 6,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    );
  }
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
