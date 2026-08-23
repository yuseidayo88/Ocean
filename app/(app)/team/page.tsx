'use client';

import { useEffect, useState } from 'react';

import { useOpen, openHref } from '@/lib/use-open';
import { Go as Link } from '@/components/ui/Go';
import { Centre, Composer, Pane, Section, TopBar } from '@/components/shell/Chrome';
import { EffortInline, ModelInline, Toggle } from '@/components/shell/Controls';
import { AMBER, AMBER_T, BLUE, COMPOSER_H, DIM, EDGE, GREEN, GREEN_T, HAIR, MUTE, RAIL, RULE, SEAM, T2, T3, T4, T5 } from '@/lib/design/tokens';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR, EFFORT_WORDS, EMPLOYEES, EXEC, HIRE_SUGGESTION, MODELS, RULES, SKILLS, type Employee } from '@/lib/dummy';
import { pressable } from '@/lib/a11y';
import { hire, listEmployees } from '@/app/actions/run';
import { definitionOf } from '@/lib/roster';
import type { LiveEmployee } from '@/lib/store';
import { useShell } from '@/components/shell/Shell';

/**
 * メンバー＝**どんなAI社員がいて、何を頼めるか**（C案）。
 *
 * 表をやめた。列で並べると「いま何をしているか」が主役になり、
 * デスク（手もと）・オフィス（誰がいるか）・成果物（何ができたか）と重なっていた。
 * メンバーだけが持てるのは **この会社は何ができて、どう働かせるか**。
 *
 * ・1行が3段 — 名前 / 何をするか（約束）/ できること
 * ・**統括AIをいちばん上に固定。** AI社員ではないので EMPLOYEES には入れない
 *   （採用も解雇もできない）。モデル・深さ・設定は社員と同じに持つ
 * ・**モデルと深さは別々の操作。右に縦に積む。どちらも枠を持たない**
 * ・深さ ＝ thinking の量。いちばん左が「考えずに答える」。**モデルは変わらない**
 * ・歯車 ＝ その社員の設定（スキル・ルール・一時停止）。名前の行に上揃え
 * ・要確認 は文字の右の書類アイコンから、その成果物へ飛ぶ
 */

/** 統括AIも社員も同じ形で描くための、行1本ぶんの持ちもの */
type Line = {
  id: string; name: string; en: string; state: string; color: string; seed: number;
  lead: string; can: string[]; canMore: number; model: string; effort: number;
};

const line = (e: Employee): Line => ({
  id: e.id, name: e.name, en: e.en, state: e.state, color: AGENT_COLOR[e.color], seed: e.name.length * 7 + 3,
  lead: e.lead, can: e.can, canMore: e.canMore, model: e.model, effort: e.effort,
});

/** 全員に効くことを開いているときの id */
const ALL = 'all';

const EXEC_LINE: Line = {
  id: EXEC.id, name: EXEC.name, en: EXEC.en, state: EXEC.state, color: EXEC.color, seed: 5,
  lead: EXEC.lead, can: EXEC.can, canMore: EXEC.canMore, model: EXEC.model, effort: EXEC.effort,
};

export default function TeamPage() {
  /** 本物の在籍（採用した社員）。**ダミーの4人のあとに並ぶ** */
  const [staff, setStaff] = useState<LiveEmployee[]>([]);
  const reloadStaff = () => { listEmployees().then(setStaff); };
  useEffect(reloadStaff, []);

  // 右は閉じた状態から始まる。行か歯車を押すと、その1人ぶんだけ開く
  const [openId, setOpenId] = useOpen();
  const sel = EMPLOYEES.find((e) => e.id === openId) ?? null;
  const execOn = openId === EXEC.id;
  const allOn = openId === ALL;
  const gate = EMPLOYEES.find((e) => e.state === '要確認') ?? null;
  const { say5 } = useShell();

  return (
    <>
      <Centre>
        <TopBar title="メンバー" onPanel={() => setOpenId(EXEC.id)} panelOn={!!openId} />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `18px 30px ${COMPOSER_H}px` }}>
          {/* 答えを先に1行。数えるのは放っておけないものだけ */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 16 }}>
            <span style={{ fontSize: 16, lineHeight: '26px' }}>
              {EMPLOYEES.length}人。
              {gate
                ? <><span style={{ color: AMBER_T }}>{gate.name}</span>があなたの確認を待っています。</>
                : <>待っているものはありません。</>}
            </span>
            <div style={{ flex: 1 }} />
            <Link href="/hire" className="btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 12px',
              borderRadius: 8, background: RAIL, border: `1px solid ${RULE}`, color: T2, fontSize: 12.5,
            }}>
              <Icon name="plus" color={T4} size={13} />採用する
            </Link>
          </div>

          {/* 統括AI は社員より上。設定はできるが、止めることも外すこともできない */}
          <Row l={EXEC_LINE} top on={openId === EXEC.id} onOpen={() => setOpenId(EXEC.id)} />
          <div style={{ height: 1, background: RULE }} />

          {staff.map((e) => {
            const d = definitionOf(e.definitionId);
            const l: Line = {
              id: e.id, name: e.name, en: d?.en ?? '', state: e.state === 'running' ? '実行中' : '待機',
              color: e.color, seed: e.name.length * 7 + 3,
              lead: d?.mission ?? '', can: (d?.rules ?? []).slice(0, 2).map((r) => r.split('。')[0]),
              canMore: 0, model: '自動', effort: 2,
            };
            return <Row key={e.id} l={l} on={openId === e.id} onOpen={() => setOpenId(e.id)} />;
          })}
          {EMPLOYEES.map((e, i) => (
            <Row key={e.id} l={line(e)} on={e.id === openId} onOpen={() => setOpenId(e.id)} top={i === 0} />
          ))}

          {/* 全員に効くもの。社員の行と同じ列（79px）から始める */}
          <div style={{ height: 1, background: SEAM }} />
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0 0' }}>
            <span style={{ width: 49, flexShrink: 0, color: T5, fontSize: 11 }}>全員</span>
            <span style={{ color: T3, fontSize: 12.5 }}>
              {SKILLS.filter((s) => s.scope === 'company').map((s) => s.name).join(' · ')} · {RULES[0]}
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setOpenId(ALL)} className="icob" aria-label="全員に効くスキルとルール" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            }}>
              <Icon name="gear" color={T4} size={16} width={1.2} />
            </button>
          </div>

          {/* 統括AIからの提案。無ければこの行ごと出さない。「あとで」は置かない */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, padding: '15px 16px',
            borderRadius: 12, border: `1px dashed ${RULE}` }}>
            <Orb color={AGENT_COLOR.cyan} size={32} seed={11} />
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                <span style={{ fontSize: 14 }}>{HIRE_SUGGESTION.name}</span>
                <span style={{ color: '#454545', fontSize: 11 }}>Content Writer</span>
              </div>
              <span style={{ color: T4, fontSize: 12.5 }}>{HIRE_SUGGESTION.reason}</span>
            </div>
            <div style={{ flex: 1 }} />
            <Link href="/hire" className="lnk" style={{ color: T5, fontSize: 12, flexShrink: 0 }}>ほかの候補を見る ›</Link>
            <button onClick={async () => {
              const r = await hire('content-writer', '執筆担当');
              say5(r.ok ? '執筆担当 を採用しました。下に並びます' : r.message ?? '採用できませんでした');
              reloadStaff();
            }} className="solid" style={{
              display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 14px',
              borderRadius: 8, background: BLUE, color: '#fff', fontSize: 12.5, flexShrink: 0,
            }}>採用する</button>
          </div>
        </div>

        <Composer placeholder="統括AIに聞く" />
      </Centre>

      {/* **右ペインは1枚。** 社員も統括AIも全員も、同じ器で開く */}
      {(sel || execOn || allOn) && (
        <SettingsPane
          who={allOn ? 'all' : execOn ? 'exec' : 'employee'}
          e={sel}
          onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

/**
 * 1人ぶんの行。3段 — 名前 / 約束 / できること。
 * 右にモデルと深さを縦に積み、いちばん右に歯車を**名前の行に上揃え**で置く。
 */
function Row({ l, on, onOpen, top }: { l: Line; on?: boolean; onOpen?: () => void; top?: boolean }) {
  const warn = l.state === '要確認';
  const press = onOpen ? pressable(onOpen) : {};
  return (
    <div className={onOpen ? 'row' : undefined} {...press} style={{
      display: 'flex', gap: 13, padding: warn ? '17px 10px' : '17px 0',
      borderTop: top ? undefined : `1px solid ${SEAM}`,
      borderRadius: warn ? 10 : undefined, margin: warn ? '0 -10px' : undefined,
      background: warn ? 'rgba(227,116,0,0.055)' : on ? '#0C0C0C' : undefined,
      boxShadow: on && !warn ? `inset 3px 0 0 ${l.color}` : undefined,
    }}>
      <Orb color={l.color} size={40} seed={l.seed} dim={l.state === '待機'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 24 }}>
              <span style={{ fontSize: 15.5 }}>{l.name}</span>
              <span style={{ color: '#454545', fontSize: 11 }}>{l.en}</span>
              <StateMark state={l.state} />
            </div>
            <div style={{ color: T2, fontSize: 13.5, lineHeight: '21px' }}>{l.lead}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', minHeight: 26 }}>
              {l.can.map((c) => (
                <span key={c} style={{
                  display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', borderRadius: 7,
                  background: '#131313', border: '1px solid #212121', color: T2, fontSize: 11.5,
                }}>{c}</span>
              ))}
              {l.canMore > 0 && <span style={{ color: MUTE, fontSize: 11.5, padding: '0 2px' }}>+{l.canMore}</span>}
            </div>
          </div>

          {/* モデルと深さ。**別々の操作**で、右に縦に積む。どちらも枠を持たない */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <ModelInline value={l.model} models={MODELS} />
              <EffortInline value={l.effort} words={EFFORT_WORDS} />
            </div>
            {/* 歯車 ＝ その社員の設定。**右ペインで開く**（画面ごと移動しない） */}
            <button className="icob" aria-label={`${l.name}の設定`}
              onClick={(e) => { e.stopPropagation(); onOpen?.(); }} style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: -1,
              }}>
              <Icon name="gear" color={T4} size={16} width={1.2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 状態。**要確認 だけ押せる** — あなたが成果物を見るので、書類のアイコンからそこへ飛ぶ。
 * 「見て決める」のボタンは置かない（行の中でいちばん強い面になっていた）。
 */
function StateMark({ state }: { state: string }) {
  const warn = state === '要確認';
  const dot = warn ? AMBER : state === '実行中' ? GREEN : MUTE;
  const text = warn ? AMBER_T : state === '実行中' ? GREEN_T : T4;
  const inner = <>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }} />
    <span style={{ color: text, fontSize: 12 }}>{state}</span>
  </>;
  if (!warn) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{inner}</span>;
  return (
    <Link href={openHref('/deliverables', 'd-rev')} onClick={(e) => e.stopPropagation()} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, height: 24, padding: '0 8px', borderRadius: 7,
      boxShadow: 'inset 0 0 0 40px rgba(227,116,0,0.10)',
    }}>
      {inner}
      <Icon name="deliv" color="#E8973A" size={14} width={1.4} />
    </Link>
  );
}

/**
 * 設定のペイン。**社員も統括AIも「全員に効くこと」も、同じ器で開く。**
 * 右は1枚しかないので、器を分けると同じものを3つ作ることになる。
 *
 * 違うのは3つだけ —
 *   ・統括AI は**止められない**（会社に1人しかいない）
 *   ・全員に効くことは**人ではない**ので、モデルも深さも一時停止も持たない
 *   ・スキルは「この社員の」と「会社ぜんぶの」に分かれる（`employee_id` が null なら共通）
 *
 * **保存ボタンを置かない**（切り替えたその場で効く）。道具は社長に触らせない。
 */
function SettingsPane({ who, e, onClose }:
  { who: 'employee' | 'exec' | 'all'; e: Employee | null; onClose: () => void }) {
  const mine = SKILLS.filter((s) => s.scope === 'employee');
  const shared = SKILLS.filter((s) => s.scope === 'company');
  // 全員に効くことを見ているときは、会社ぜんぶのスキルだけ
  const skills = who === 'all' ? shared : [...mine, ...shared];
  const title = who === 'all' ? '全員に効くこと' : who === 'exec' ? '統括AIの設定' : 'AI社員の設定';

  return (
    <Pane width={430} icon="gear" title={title} onClose={onClose}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 24px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        {who !== 'all' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Orb color={who === 'exec' ? EXEC.color : AGENT_COLOR[e!.color]} size={44}
                 seed={who === 'exec' ? 5 : e!.name.length * 7 + 3} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                <span style={{ fontSize: 15 }}>{who === 'exec' ? EXEC.name : e!.name}</span>
                <span style={{ color: '#454545', fontSize: 11 }}>{who === 'exec' ? EXEC.en : e!.en}</span>
              </div>
              <span style={{ color: T5, fontSize: 11.5 }}>
                {who === 'exec' ? '会社に1人。止めることも外すこともできません' : `${e!.role} · ${e!.since}から在籍`}
              </span>
            </div>
          </div>
        )}
        {who === 'all' && (
          <span style={{ color: T3, fontSize: 13, lineHeight: '21px' }}>
            ここに入れたものは、統括AIと全部のAI社員に効きます。
          </span>
        )}

        {/* 面に出さないのはこの2つ。行には「できること」だけ出す */}
        <Section label={who === 'all' ? '会社ぜんぶのスキル' : 'スキル'} right={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T4, fontSize: 12 }}>
            <Icon name="plus" color={T4} size={12} />追加
          </span>
        }>
          {skills.map((s, i) => (
            <Link key={s.id} href={openHref('/skills', s.file)} className="row" style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
              borderBottom: i === skills.length - 1 ? undefined : `1px solid ${HAIR}`,
            }}>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{s.file}</span>
              </div>
              <div style={{ flex: 1 }} />
              <span onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}><Toggle on={s.on} /></span>
            </Link>
          ))}
        </Section>

        <Section label="ルール" right={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T4, fontSize: 12 }}>
            <Icon name="plus" color={T4} size={12} />追加
          </span>
        }>
          {RULES.map((r, i) => (
            <div key={r} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 10px 11px',
              borderLeft: `2px solid ${RULE}`,
              borderBottom: i === RULES.length - 1 ? undefined : `1px solid ${HAIR}`,
            }}>
              <span style={{ color: T2, fontSize: 12.5, lineHeight: '19px' }}>{r}</span>
              <div style={{ flex: 1 }} />
              <Icon name="close" color={DIM} size={12} />
            </div>
          ))}
        </Section>

        {/* 人ではないものにモデルと深さは無い */}
        {who !== 'all' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: T3 }}>モデル</span>
              <div style={{ flex: 1 }} />
              <ModelInline value={who === 'exec' ? EXEC.model : e!.model} models={MODELS} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: T3 }}>思考の深さ</span>
              <div style={{ flex: 1 }} />
              <EffortInline value={who === 'exec' ? EXEC.effort : e!.effort} words={EFFORT_WORDS} />
            </div>
            <span style={{ color: T5, fontSize: 11.5 }}>
              深さは選んだモデルの中でどれだけ考えるか。モデルは変わりません
            </span>
          </div>
        )}

        {/* 保存ボタンは置かない。一時停止は保存ではないので最後の行に。
            **統括AI は止められない**ので、その行ごと出さない */}
        {who === 'employee' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
            <span style={{ color: T3 }}>この社員を一時停止する</span>
            <div style={{ flex: 1 }} />
            <span className="btn" style={{
              display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px',
              borderRadius: 8, border: `1px solid ${EDGE}`, color: T3, fontSize: 12,
            }}>一時停止</span>
          </div>
        )}
      </div>
    </Pane>
  );
}
