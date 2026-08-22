import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Ask, Chips, Composer, TopBar } from '@/components/shell/Chrome';
import { Orb } from '@/components/ui/Orb';
import { Dot, Icon } from '@/components/ui/Icon';
import { DECISIONS, THREADS, work } from '@/lib/dummy';

/**
 * チャット＝2ペインの会話（ChatGPT と同じ。右ペインなし）。
 * **会話はここに一本化する。** Work は会話を持たない。
 * 質問は会話に流さず、入力欄の上の板として出す。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663';

export function generateStaticParams() {
  return [...THREADS.map((t) => ({ id: t.id })), { id: 'new' }];
}

const You = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: '100%', maxWidth: 748, display: 'flex', justifyContent: 'flex-end' }}>
    <span style={{ maxWidth: '78%', padding: '9px 16px', borderRadius: 18, background: '#24354A', color: '#DCE7F5' }}>
      {children}
    </span>
  </div>
);

const Exec = ({ thought, children }: { thought?: string; children: React.ReactNode }) => (
  <div style={{ width: '100%', maxWidth: 748, display: 'flex', gap: 13 }}>
    <Orb color="#D2D2D2" size={26} seed={7} />
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
      {thought && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: T5, fontSize: 12 }}>
          {thought}<Icon name="chev" color={T5} size={11} />
        </span>
      )}
      <span style={{ fontSize: 15, lineHeight: '26px', color: T1 }}>{children}</span>
    </div>
  </div>
);

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === 'new') {
    return (
      <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
        <TopBar title="新しいチャット" />
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <Orb color="#D2D2D2" size={72} seed={7} />
            <span style={{ fontSize: 20 }}>何を相談しますか？</span>
          </div>
        </div>
        <Composer placeholder="統括AIに相談する" />
      </div>
    );
  }

  const th = THREADS.find((t) => t.id === id);
  if (!th) notFound();
  const dec = DECISIONS.find((d) => d.state === '判断待ち')!;

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar crumb="チャット" title={th.title} right={
        th.workId ? <Link href={`/work/${th.workId}`} style={{ color: T4, fontSize: 12 }}>{work(th.workId).title} ›</Link> : undefined
      } />

      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 22, padding: '22px 24px 0', overflowY: 'auto',
      }}>
        <You>価格ってどう決めればいいですか</You>
        <Exec thought="12秒 考えました">
          競合3社は <b>¥1,200〜¥3,900</b> に集中していました。価格そのものより、
          <b>会話の練習をどこまで含めるか</b>で決まります。3社とも、そこを有料オプションにしています。
        </Exec>
        <You>じゃあ会話まで入れたらいくらにできる？</You>
        <Exec thought="24秒 考えました">
          月 <b>¥1,980</b> なら、解約率12%の前提で初年度がいちばん残ります。
          収益モデル比較レポートに3案の内訳を出しました。決めてもらえれば、次のフェーズを開けます。
        </Exec>
        <div style={{ width: '100%', maxWidth: 748, display: 'flex', alignItems: 'center', gap: 9 }}>
          <Dot color={AMBER} size={7} />
          <span style={{ color: AMBER_T, fontSize: 12.5 }}>確認したいことがあります</span>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <Composer placeholder="続けて書く、@ で資料を参照"
        above={<Ask q={dec.question} idx={1} total={1}
                    options={dec.options!.map((o) => ({ label: o.label, note: o.note, recommended: o.recommended }))}
                    free="自分で書く" />} />
    </div>
  );
}
