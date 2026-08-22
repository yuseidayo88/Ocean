import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Ask, Composer, TopBar } from '@/components/shell/Chrome';
import { Orb } from '@/components/ui/Orb';
import { Dot, Icon } from '@/components/ui/Icon';
import { THREADS, work } from '@/lib/dummy';

/**
 * チャット＝2ペインの会話（ChatGPT と同じ。右ペインなし）。
 * **会話はここに一本化する。** Work は会話を持たない。
 * 質問は会話に流さず、入力欄の上にくっついた板として出す。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', GREEN_T = '#5BB974';

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
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
      {thought && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: T5, fontSize: 12 }}>
          {thought}<Icon name="chev" color={T5} size={11} />
        </span>
      )}
      {children}
    </div>
  </div>
);

const OPTIONS = [
  ['A案', '¥980',   '入りやすいが利益が薄い'],
  ['B案', '¥1,980', '競合と同じ帯・利益が残る'],
  ['C案', '¥3,980', '高い理由を作る必要がある'],
];

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
            <span style={{ color: T5, fontSize: 12.5 }}>待っています</span>
          </div>
        </div>
        <Composer placeholder="統括AIに書く" />
      </div>
    );
  }

  const th = THREADS.find((t) => t.id === id);
  if (!th) notFound();

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar crumb="チャット" title={th.title} right={
        th.workId
          ? <Link href={`/work/${th.workId}`} style={{ color: T5, fontSize: 12 }}>{work(th.workId).title}</Link>
          : undefined
      } />

      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 22, padding: '22px 24px 0', overflowY: 'auto',
      }}>
        <You>価格どうしようか</You>

        <Exec thought="12秒 考えました">
          <span style={{ fontSize: 15, lineHeight: '26px', color: T1 }}>
            3案で比べました。<b>B案（月額 ¥1,980）</b>をすすめます。<br />
            韓国の競合が ₩19,900（約 ¥2,200）に集まっていて、そこが値ごろの基準になっているからです。
          </span>

          {/* 比較は表で出す。文章で言い直さない */}
          <div style={{ borderRadius: 10, background: '#0C0C0C', border: '1px solid #1C1C1C', overflow: 'hidden', marginTop: 2 }}>
            {OPTIONS.map(([k, v, note], i) => {
              const hi = i === 1;
              return (
                <div key={k} style={{
                  display: 'flex', alignItems: 'center', gap: 16, height: 44, padding: '0 15px',
                  borderBottom: i === OPTIONS.length - 1 ? undefined : '1px solid #161616',
                  background: hi ? 'rgba(30,142,62,0.10)' : undefined,
                }}>
                  <span style={{ width: 40, color: hi ? T1 : T4 }}>{k}</span>
                  <span style={{ width: 66, color: hi ? T1 : T4 }} className="tnum">{v}</span>
                  <span style={{ color: hi ? T2 : T5, fontSize: 12.5 }}>{note}</span>
                </div>
              );
            })}
          </div>

          <span style={{ fontSize: 15, lineHeight: '26px', color: T1 }}>
            A案は「安かろう」に見られ、C案は選ぶ理由をこちらで用意する必要があります。
          </span>
        </Exec>

        <div style={{ width: '100%', maxWidth: 748, display: 'flex', alignItems: 'center', gap: 9 }}>
          <Dot color={AMBER} size={7} />
          <span style={{ color: AMBER_T, fontSize: 12.5 }}>確認したいことがあります</span>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <Composer placeholder="統括AIに書く"
        above={<Ask q="月額はいくらにしますか？" idx={1} total={2} free="ほかの内容を書く"
          options={[
            { label: '¥1,980', note: '競合と同じ帯。利益も残る。ここが値ごろの基準になります', recommended: true },
            { label: '¥980',   note: '入りやすいが利益が薄い。あとからの値上げは効きにくい' },
            { label: '¥3,980', note: '競合より高いので、選ぶ理由をこちらで用意します' },
          ]} />} />
    </div>
  );
}
