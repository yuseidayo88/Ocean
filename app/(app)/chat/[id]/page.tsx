import { notFound } from 'next/navigation';
import { Go as Link } from '@/components/ui/Go';
import { Ask, Composer, TopBar } from '@/components/shell/Chrome';
import { Orb } from '@/components/ui/Orb';
import { Dot, Icon } from '@/components/ui/Icon';
import { CHATS, THREADS, work } from '@/lib/dummy';
import type { Turn } from '@/lib/dummy';

/**
 * チャット＝2ペインの会話（ChatGPT と同じ。右ペインなし）。
 * **会話はここに一本化する。** Work は会話を持たない。
 * 質問は会話に流さず、入力欄の上にくっついた板として出す。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T4 = '#6E6E6E', T5 = '#5F5F5F';
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
  <div style={{ width: '100%', maxWidth: 748, display: 'flex', flexDirection: 'column', gap: 12 }}>
    {thought && (
      <span style={{
        alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 7, color: T5, fontSize: 12,
      }}>
        {thought}<Icon name="chev" color={T5} size={11} />
      </span>
    )}
    {children}
  </div>
);


/** 本文。改行と **強調** だけ通す（マークダウンは持ち込まない） */
function Body({ text }: { text: string }) {
  return (
    <span style={{ fontSize: 15, lineHeight: '26px', color: T1 }}>
      {text.split('\n').map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 ? <b key={j}>{part}</b> : part))}
        </span>
      ))}
    </span>
  );
}

/** 比べるものは棒で。枠で囲わず、行だけ並べる */
function Bars({ bars }: { bars: NonNullable<Extract<Turn, { who: 'exec' }>['bars']> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 2px' }}>
      {bars.map((b) => (
        <div key={b.k} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 62, flexShrink: 0, color: b.hi ? T1 : T4 }}>{b.k}</span>
          <span style={{ width: 66, flexShrink: 0, color: b.hi ? T1 : T4 }} className="tnum">{b.v}</span>
          <span style={{ flex: 1, minWidth: 0, height: 6, borderRadius: 3, background: '#1A1A1A', overflow: 'hidden' }}>
            <span style={{ display: 'block', width: `${b.pct}%`, height: '100%', background: b.hi ? '#1E8E3E' : '#3A3A3A' }} />
          </span>
          <span style={{ width: 190, flexShrink: 0, textAlign: 'right', color: b.hi ? T2 : T5, fontSize: 12.5 }}>{b.note}</span>
        </div>
      ))}
    </div>
  );
}

/** 順番があるものはヘアラインだけで区切る（枠を付けない） */
function Steps({ steps }: { steps: [string, string][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 0' }}>
      {steps.map(([k, v], i) => (
        <div key={k} style={{
          display: 'flex', alignItems: 'center', gap: 16, height: 38,
          borderTop: i ? '1px solid #161616' : undefined,
        }}>
          <span style={{ width: 108, flexShrink: 0, color: T2, fontSize: 13 }}>{k}</span>
          <span style={{ flex: 1, minWidth: 0, color: T4, fontSize: 13 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

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
        <Composer placeholder="統括AIに書く" local />
      </div>
    );
  }

  const th = THREADS.find((t) => t.id === id);
  if (!th) notFound();
  const c = CHATS[th.id] ?? { turns: [] };

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
        {c.turns.map((t, i) => (
          t.who === 'you'
            ? <You key={i}>{t.text}</You>
            : (
              <Exec key={i} thought={t.thought}>
                <Body text={t.lead} />
                {t.bars && <Bars bars={t.bars} />}
                {t.steps && <Steps steps={t.steps} />}
                {t.tail && <Body text={t.tail} />}
              </Exec>
            )
        ))}

        {c.ask && (
          <div style={{ width: '100%', maxWidth: 748, display: 'flex', alignItems: 'center', gap: 9 }}>
            <Dot color={AMBER} size={7} />
            <span style={{ color: AMBER_T, fontSize: 12.5 }}>確認したいことがあります</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
      </div>

      <Composer placeholder="統括AIに書く" local
        above={c.ask && <Ask q={c.ask.q} idx={c.ask.idx} total={c.ask.total} free={c.ask.free} options={c.ask.options} />} />
    </div>
  );
}
