'use client';

import { useOpen, openHref } from '@/lib/use-open';
import { Go as Link } from '@/components/ui/Go';
import { Centre, Composer, Pane, Section, TopBar } from '@/components/shell/Chrome';
import { EffortInline, ModelInline, Toggle } from '@/components/shell/Controls';
import { COMPOSER_H } from '@/lib/design/tokens';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import {
  AGENT_COLOR, EFFORT_WORDS, EMPLOYEES, EXEC, HIRE_SUGGESTION, MODELS, RULES, SKILLS,
  type Employee,
} from '@/lib/dummy';
import { pressable } from '@/lib/a11y';

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

const T1 = '#EDEDED', T2 = '#B8B8B8', T3 = '#8B8B8B', T4 = '#6E6E6E', T5 = '#5F5F5F';
const BLUE = '#1A73E8', AMBER = '#E37400', AMBER_T = '#FDD663', GREEN = '#1E8E3E', GREEN_T = '#5BB974';

/** 統括AIも社員も同じ形で描くための、行1本ぶんの持ちもの */
type Line = {
  id: string; name: string; en: string; state: string; color: string; seed: number;
  lead: string; can: string[]; canMore: number; model: string; effort: number;
};

const line = (e: Employee): Line => ({
  id: e.id, name: e.name, en: e.en, state: e.state, color: AGENT_COLOR[e.color], seed: e.name.length * 7 + 3,
  lead: e.lead, can: e.can, canMore: e.canMore, model: e.model, effort: e.effort,
});

const EXEC_LINE: Line = {
  id: EXEC.id, name: EXEC.name, en: EXEC.en, state: EXEC.state, color: EXEC.color, seed: 5,
  lead: EXEC.lead, can: EXEC.can, canMore: EXEC.canMore, model: EXEC.model, effort: EXEC.effort,
};

export default function TeamPage() {
  // 右は閉じた状態から始まる。行か歯車を押すと、その1人ぶんだけ開く
  const [openId, setOpenId] = useOpen();
  const sel = EMPLOYEES.find((e) => e.id === openId) ?? null;
  const gate = EMPLOYEES.find((e) => e.state === '要確認') ?? null;

  return (
    <>
      <Centre>
        <TopBar title="メンバー" onPanel={() => setOpenId(EMPLOYEES[0].id)} panelOn={!!openId} />

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
              borderRadius: 8, background: '#141414', border: '1px solid #262626', color: T2, fontSize: 12.5,
            }}>
              <Icon name="plus" color={T4} size={13} />採用する
            </Link>
          </div>

          {/* 統括AI は社員より上。設定はできるが、止めることも外すこともできない */}
          <Row l={EXEC_LINE} top />
          <div style={{ height: 1, background: '#262626' }} />

          {EMPLOYEES.map((e, i) => (
            <Row key={e.id} l={line(e)} on={e.id === openId} onOpen={() => setOpenId(e.id)} top={i === 0} />
          ))}

          {/* 全員に効くもの。社員の行と同じ列（79px）から始める */}
          <div style={{ height: 1, background: '#1C1C1C' }} />
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0 0' }}>
            <span style={{ width: 49, flexShrink: 0, color: T5, fontSize: 11 }}>全員</span>
            <span style={{ color: T3, fontSize: 12.5 }}>
              {SKILLS.filter((s) => s.scope === 'company').map((s) => s.name).join(' · ')} · {RULES[0]}
            </span>
            <div style={{ flex: 1 }} />
            <Link href="/skills" className="icob" aria-label="全員に効くスキルとルール" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            }}>
              <Icon name="gear" color={T4} size={16} width={1.2} />
            </Link>
          </div>

          {/* 統括AIからの提案。無ければこの行ごと出さない。「あとで」は置かない */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22, padding: '15px 16px',
            borderRadius: 12, border: '1px dashed #262626' }}>
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
            <span className="solid" style={{
              display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 14px',
              borderRadius: 8, background: BLUE, color: '#fff', fontSize: 12.5, flexShrink: 0,
            }}>採用する</span>
          </div>
        </div>

        <Composer placeholder="統括AIに聞く" />
      </Centre>

      {sel && <SettingsPane e={sel} onClose={() => setOpenId(null)} />}
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
      borderTop: top ? undefined : '1px solid #1C1C1C',
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
              {l.canMore > 0 && <span style={{ color: '#4A4A4A', fontSize: 11.5, padding: '0 2px' }}>+{l.canMore}</span>}
            </div>
          </div>

          {/* モデルと深さ。**別々の操作**で、右に縦に積む。どちらも枠を持たない */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
              <ModelInline value={l.model} models={MODELS} />
              <EffortInline value={l.effort} words={EFFORT_WORDS} />
            </div>
            {onOpen ? (
              <button className="icob" aria-label={`${l.name}の設定`}
                onClick={(e) => { e.stopPropagation(); onOpen(); }} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: -1,
                }}>
                <Icon name="gear" color={T4} size={16} width={1.2} />
              </button>
            ) : (
              <Link href="/skills" className="icob" aria-label="統括AIの設定" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: -1,
              }}>
                <Icon name="gear" color={T4} size={16} width={1.2} />
              </Link>
            )}
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
  const dot = warn ? AMBER : state === '実行中' ? GREEN : '#4A4A4A';
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

/** AI社員の設定。**保存ボタンを置かない**（切り替えたその場で効く）。道具は社長に触らせない */
function SettingsPane({ e, onClose }: { e: Employee; onClose: () => void }) {
  const mine = SKILLS.filter((s) => s.scope === 'employee');
  const shared = SKILLS.filter((s) => s.scope === 'company');
  const all = [...mine, ...shared];
  return (
    <Pane width={430} icon="gear" title="AI社員の設定" onClose={onClose}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 24px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <Orb color={AGENT_COLOR[e.color]} size={44} seed={e.name.length * 7 + 3} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontSize: 15 }}>{e.name}</span>
              <span style={{ color: '#454545', fontSize: 11 }}>{e.en}</span>
            </div>
            <span style={{ color: T5, fontSize: 11.5 }}>{e.role} · {e.since}から在籍</span>
          </div>
        </div>

        {/* 面に出さないのはこの2つ。行には「できること」だけ出す */}
        <Section label="スキル" right={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T4, fontSize: 12 }}>
            <Icon name="plus" color={T4} size={12} />追加
          </span>
        }>
          {all.map((s, i) => (
            <Link key={s.id} href={openHref('/skills', s.file)} className="row" style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
              borderBottom: i === all.length - 1 ? undefined : '1px solid #161616',
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
              borderLeft: '2px solid #262626',
              borderBottom: i === RULES.length - 1 ? undefined : '1px solid #161616',
            }}>
              <span style={{ color: T2, fontSize: 12.5, lineHeight: '19px' }}>{r}</span>
              <div style={{ flex: 1 }} />
              <Icon name="close" color="#3A3A3A" size={12} />
            </div>
          ))}
        </Section>

        {/* モデルと深さは行にもある。同じものをここにも置いて、どちらからでも変えられる */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ color: T3 }}>モデル</span>
            <div style={{ flex: 1 }} />
            <ModelInline value={e.model} models={MODELS} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ color: T3 }}>思考の深さ</span>
            <div style={{ flex: 1 }} />
            <EffortInline value={e.effort} words={EFFORT_WORDS} />
          </div>
          <span style={{ color: T5, fontSize: 11.5 }}>
            深さは選んだモデルの中でどれだけ考えるか。モデルは変わりません
          </span>
        </div>

        {/* 保存ボタンは置かない。一時停止は保存ではないので最後の行に */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 2 }}>
          <span style={{ color: T3 }}>この社員を一時停止する</span>
          <div style={{ flex: 1 }} />
          <span className="btn" style={{
            display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px',
            borderRadius: 8, border: '1px solid #2A2A2A', color: T3, fontSize: 12,
          }}>一時停止</span>
        </div>
      </div>
    </Pane>
  );
}
