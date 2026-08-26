'use client';

import { Go as Link } from '@/components/ui/Go';
import { useEffect, useState } from 'react';
import { Centre, Composer, TopBar } from '@/components/shell/Chrome';
import { Dot, Icon } from '@/components/ui/Icon';
import { decide, listDecisions } from '@/app/actions/run';
import { wakePump } from '@/lib/pump';
import { ago } from '@/lib/when';
import type { LiveDecision } from '@/lib/store';
import { AMBER, AMBER_T, COMPOSER_H, GREEN, GREEN_T, HAIR, SEAM, T1, T2, T3, T4, T5 } from '@/lib/design/tokens';
/**
 * 決定事項＝台帳タイムライン。**追記のみ**（決め直しは新しい行＋supersedes）。
 * 左に相対時刻、丸い印でつながる。判断待ちは選択肢を棒で並べて、その場で読めるようにする。
 * 質問はここに出さない。事業判断だけが昇格する。
 */

/** 本物の決定の1件。開いている判断はその場で決められる */
function LiveRow({ d, last, onDecide }: { d: LiveDecision; last: boolean; onDecide: (id: string, label: string) => void }) {
  const wait = d.status === 'open';
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <span style={{ width: 58, flexShrink: 0, textAlign: 'right', color: T5, fontSize: 11, paddingTop: 14 }}>
        {ago(d.when)}
      </span>
      <div style={{ width: 14, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ height: 14 }} />
        {wait
          ? <span style={{ width: 13, height: 13, borderRadius: 999, border: `2px solid ${AMBER}`, flexShrink: 0 }} />
          : <span style={{
              width: 13, height: 13, borderRadius: 999, background: GREEN, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon name="check" color="#000" size={9} width={3} /></span>}
        {!last && <div style={{ flex: 1, width: 1, background: SEAM }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 22, borderBottom: last ? undefined : `1px solid ${HAIR}`, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40 }}>
          <span style={{ color: T1 }}>{d.question}</span>
          {/* **どの Work の判断か。** 台帳は会社ぜんぶを1本に並べるので、これが無いと話が分からない */}
          {/* **同じ名前を2回置かない** — 探索から立てた Work は、題が選んだ案そのもの */}
          {d.workTitle && d.workTitle !== d.chosen && (
            <span style={{ minWidth: 0, color: T5, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.workTitle}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {wait ? <span style={{ color: AMBER_T }}>判断待ち</span> : <span style={{ color: GREEN_T }}>決定</span>}
        </div>
        {/**
          * **理由は決めたあとも残す**（2026-08-26）。
          * 前は `wait` のあいだしか出しておらず、決めた瞬間に「なぜ聞かれたのか」が消えていた。
          * 台帳は**あとから読むもの**なので、いちばん残すべきものを捨てていたことになる。
          */}
        {d.why && <span style={{ color: T5, fontSize: 12, display: 'block', paddingBottom: 8 }}>{d.why}</span>}
        {/**
          * **選ばなかった道も残す**（→ CLAUDE.md「なぜその道かは、選ばなかった道と並べて意味になる」）。
          * 決めたあとは押せない — 選んだものに緑のチェック、ほかは暗く沈める。
          * 前は `chosen` の1語だけになっていたので、**何と比べて決めたのかが台帳から消えていた**。
          */}
        {d.options.map((o) => {
          const took = !wait && o.label === d.chosen;
          const row = (
            <>
              <span style={{ width: 15, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
                {took ? <Icon name="check" color={GREEN_T} size={12} width={2.5} /> : null}
              </span>
              <span style={{ flexShrink: 0, color: wait ? (o.recommended ? T1 : T4) : took ? T1 : T5 }}>{o.label}</span>
              {wait && o.recommended && <span style={{ color: GREEN_T, fontSize: 11 }}>推奨</span>}
              <span style={{
                minWidth: 0, color: took ? T4 : T5, fontSize: 12,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{o.description}</span>
            </>
          );
          const box: React.CSSProperties = {
            display: 'flex', alignItems: 'center', gap: 12, height: 41, width: '100%',
            borderRadius: 7, padding: '0 8px', margin: '0 -8px', textAlign: 'left',
            opacity: !wait && !took ? 0.5 : 1,
          };
          // 決まったあとは**押せる顔をしない**（押しても何も起きないものを置かない）
          return wait
            ? <button key={o.label} onClick={() => onDecide(d.id, o.label)} className="row" style={box}>{row}</button>
            : <div key={o.label} style={box}>{row}</div>;
        })}
        {/* 台帳に無い答え（統括AIが選択肢の外で決まったことを残した等）は、そのまま出す */}
        {!wait && d.chosen && !d.options.some((o) => o.label === d.chosen) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, height: 41, padding: '0 8px', margin: '0 -8px' }}>
            <span style={{ width: 15, display: 'inline-flex', justifyContent: 'center' }}>
              <Icon name="check" color={GREEN_T} size={12} width={2.5} />
            </span>
            <span style={{ color: T1 }}>{d.chosen}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export default function DecisionsPage() {
  /** 本物の決定（AI社員が聞いた・社長が決めたもの）だけ。台帳は追記のみ */
  const [live, setLive] = useState<LiveDecision[] | null>(null);
  const reload = () => { listDecisions().then(setLive); };
  useEffect(reload, []);
  const onDecide = async (id: string, label: string) => { await decide(id, label); wakePump(); reload(); };

  const all = live ?? [];
  const gates = all.filter((d) => d.status === 'open').length;

  return (
    <Centre>
      <TopBar title="決定事項" />

      {all.length > 0 && (
        <div style={{
          height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9,
          padding: '0 18px', borderBottom: `1px solid ${HAIR}`,
        }}>
          <Icon name="dec" color={T3} size={15} />
          <span>決定事項</span>
          <span style={{ color: T5 }} className="tnum">· {all.length}</span>
          <div style={{ flex: 1 }} />
          {gates > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: AMBER_T }}>
              <Dot color={AMBER} size={7} />判断待ち {gates}
            </span>
          )}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `16px 24px ${COMPOSER_H}px` }}>
        {live !== null && all.length === 0 && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, color: T2 }}>決めたことはまだありません</span>
            <span style={{ color: T5, fontSize: 13 }}>
              AI社員が事業の判断に当たると、ここで聞かれます — <Link href="/start" className="lnk" style={{ color: T3 }}>はじめる ›</Link>
            </span>
          </div>
        )}
        {all.map((d, i) => (
          <LiveRow key={d.id} d={d} last={i === all.length - 1} onDecide={onDecide} />
        ))}
      </div>

      <Composer placeholder="統括AIに相談する" />
    </Centre>
  );
}
