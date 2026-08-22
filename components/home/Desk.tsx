'use client';

import { Orb } from '@/components/ui/Orb';
import { Dot, Icon } from '@/components/ui/Icon';
import { AGENT_COLOR, EMPLOYEES, employee, work } from '@/lib/dummy';

/**
 * デスク＝縦長レーンを横に並べる。稼働中の社員の手もとを一気に見る。
 * 中身の器は担当ではなく **produces** で決める（業種を埋め込まない）。
 * 本当に動く前提の形なので、止まっているときは止まっていると出す。
 * 判断待ち／要確認のレーンだけ橙。
 */

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const AMBER = '#E37400', AMBER_T = '#FDD663', GREEN_T = '#5BB974';

type Produces = 'facts' | 'text' | 'code' | 'review';

const LANES: { id: string; line: string; steps: [string, string][]; produces: Produces; workId: string; body: string[]; taskDone: number; taskAll: number }[] = [
  { id: 'e-research', workId: 'w-japanese', produces: 'facts',
    line: '競合3社の価格ページを読んでいます',
    steps: [['検索', '12秒'], ['取得 8件', '41秒'], ['要約', '1分06秒'], ['書き出し', '—']],
    body: ['Aサービス 月 ¥1,200 / 文法中心 / 会話は別料金',
           'Bサービス 月 ¥3,900 / 会話あり / 講師は録画',
           'Cサービス 買い切り ¥19,800 / 教材のみ',
           '3社とも「話す」を有料オプションにしている'],
    taskDone: 3, taskAll: 4 },
  { id: 'e-plan', workId: 'w-sns', produces: 'text',
    line: '4週ぶんの投稿カレンダーを書いています',
    steps: [['方針を読む', '8秒'], ['型を3つ', '52秒'], ['本文', '進行中']],
    body: ['週1: 学習のつまずきを1つ取り上げる',
           '週2: 現地の会話を切り取って解説する',
           '週3: 受講者の変化を短く出す',
           '週4: 質問に答える回にする'],
    taskDone: 2, taskAll: 4 },
  { id: 'e-dev', workId: 'w-lp', produces: 'code',
    line: '申込フォームの送信処理を書いています',
    steps: [['要件を読む', '6秒'], ['雛形', '34秒'], ['実装', '進行中']],
    body: ['export async function submit(form: FormData) {',
           '  const email = form.get("email");',
           '  if (!email) return fail("メールアドレスが要ります");',
           '  await db.insert(applications).values({ email });'],
    taskDone: 1, taskAll: 2 },
  { id: 'e-strategy', workId: 'w-japanese', produces: 'review',
    line: '収益モデル比較レポートができました',
    steps: [['3案を比較', '2分14秒'], ['書き出し', '48秒'], ['提出', '完了']],
    body: ['月額 ¥1,980 が、解約率12%の前提でいちばん残ります。',
           '買い切りは初速が出ますが、2年目が続きません。'],
    taskDone: 3, taskAll: 3 },
];

function Body({ produces, lines }: { produces: Produces; lines: string[] }) {
  if (produces === 'code') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5 }}>
            <span style={{ color: '#3A3A3A', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 12}</span>
            <span style={{ color: i === lines.length - 1 ? GREEN_T : T3, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {i === lines.length - 1 ? `+ ${l}` : l}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (produces === 'facts') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 9, padding: '7px 0', borderBottom: i === lines.length - 1 ? undefined : '1px solid #161616' }}>
            <Dot color="#3A3A3A" size={5} />
            <span style={{ color: T3, fontSize: 12, lineHeight: '18px' }}>{l}</span>
          </div>
        ))}
      </div>
    );
  }
  if (produces === 'review') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.map((l, i) => <span key={i} style={{ color: T2, fontSize: 12, lineHeight: '19px' }}>{l}</span>)}
        <span style={{
          marginTop: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          height: 30, borderRadius: 8, background: 'rgba(227,116,0,0.14)', color: AMBER_T, fontSize: 12,
        }}>見て決める</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((l, i) => (
        <span key={i} style={{ color: i === lines.length - 1 ? T4 : T3, fontSize: 12, lineHeight: '19px' }}>{l}</span>
      ))}
    </div>
  );
}

export function Desk() {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <span style={{ color: T3 }}>デスク</span>
        <Dot color="#1E8E3E" size={6} />
        <span style={{ color: T5, fontSize: 12 }}>リアルタイム</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 112 }}>
        {LANES.map((l) => {
          const e = employee(l.id);
          const wait = l.produces === 'review';
          return (
            <div key={l.id} style={{
              width: 316, flexShrink: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
              gap: 12, padding: '14px 14px 12px', borderRadius: 14,
              background: wait ? 'rgba(227,116,0,0.05)' : '#0B0B0B',
              border: `1px solid ${wait ? 'rgba(227,116,0,0.28)' : '#1C1C1C'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Orb color={AGENT_COLOR[e.color]} size={30} seed={e.name.length * 7 + 3} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{e.name}</span>
                  <span style={{ color: wait ? AMBER_T : T5, fontSize: 11 }}>{e.state}</span>
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ color: T5, fontSize: 11 }}>{work(l.workId).title}</span>
              </div>

              <span style={{ color: T2, fontSize: 12.5, lineHeight: '19px' }}>{l.line}</span>

              {/* 工程を1行に畳む */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {l.steps.map(([s, t], i) => (
                  <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: i === l.steps.length - 1 ? T3 : T5, fontSize: 11 }}>{s}</span>
                    <span style={{ color: '#3A3A3A', fontSize: 11 }}>{t}</span>
                    {i < l.steps.length - 1 && <span style={{ color: '#2A2A2A' }}>·</span>}
                  </span>
                ))}
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <Body produces={l.produces} lines={l.body} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 2 }}>
                <span style={{ color: T5, fontSize: 11 }} className="tnum">タスク {l.taskDone} / {l.taskAll}</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#1A1A1A', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(l.taskDone / l.taskAll) * 100}%`, height: '100%', borderRadius: 2,
                    background: wait ? AMBER : AGENT_COLOR[e.color],
                  }} />
                </div>
              </div>
            </div>
          );
        })}

        {/* 待機は点線で沈める */}
        {EMPLOYEES.filter((e) => !LANES.some((l) => l.id === e.id)).map((e) => (
          <div key={e.id} style={{
            width: 316, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10,
            padding: 14, borderRadius: 14, border: '1px dashed #1E1E1E', opacity: 0.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Orb color={AGENT_COLOR[e.color]} size={30} seed={e.name.length * 7 + 3} dim />
              <span style={{ color: T4 }}>{e.name}</span>
              <div style={{ flex: 1 }} />
              <span style={{ color: T5, fontSize: 11 }}>待機</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
