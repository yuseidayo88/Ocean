'use client';

import { useEffect, useState } from 'react';

import { useOpen } from '@/lib/use-open';
import { Centre, Composer, Pane, Section, TopBar } from '@/components/shell/Chrome';
import { EffortInline, ModelInline, Toggle } from '@/components/shell/Controls';
import { BLUE, COMPOSER_H, DIM, EDGE, GREEN, GREEN_T, HAIR, MUTE, RULE, SEAM, T2, T3, T4, T5 } from '@/lib/design/tokens';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';
import { AGENT_COLOR, EFFORT_WORDS, EXEC, MODELS } from '@/lib/view/model';
import { MODEL_LABEL } from '@/lib/ai/tiers';
import { pressable } from '@/lib/a11y';
import { hire, listEmployees } from '@/app/actions/run';
import { learningsGet, learningsSet, skillsList, skillToggle } from '@/app/actions/live';
import { ROSTER, definitionOf, slugOf, type Definition } from '@/lib/roster';
import type { LiveEmployee, SkillRow } from '@/lib/store';
import { useShell } from '@/components/shell/Shell';

/**
 * メンバー＝**どんなAI社員がいて、何を頼めるか**（C案）。
 *
 * ・1行が3段 — 名前 / 何をするか（約束）/ できること
 * ・**統括AIをいちばん上に固定。** AI社員ではない（採用も解雇もできない）
 * ・**モデルと深さは別々の操作。右に縦に積む。どちらも枠を持たない**
 * ・歯車 ＝ その社員の設定（スキル・ルール・一時停止）。右ペインで開く
 * ・在籍は store だけ — 採用した社員が、採用した順に並ぶ。まだいなければ、いないと出す
 *
 * **まだ採用していない人も、同じ列に暗く並べる**（2026-08-24）。
 * 前は見出しの右の `＋ 採用する` で別の画面（`/hire`）へ飛ばしていたが、
 * 「この会社は何ができるか」を見にきた社長に、**在籍と候補を別々の画面で見せる理由が無い**。
 * 行は同じ形のまま、暗さと右の `採用する` だけが違う。押せば右ペインでその人を読める。
 */

/** 統括AIも社員も同じ形で描くための、行1本ぶんの持ちもの */
type Line = {
  id: string; name: string; en: string; state: string; color: string; seed: number;
  lead: string; can: string[]; canMore: number; model: string; effort: number;
  /** 定義の Critical Rules（社長は消せない）。設定のペインに出す */
  rules: string[];
  sub?: string;
  /** まだ採用していない人。**行は同じ形**で、暗さと右のボタンだけが違う */
  cand?: string;
};

/** 全員に効くことを開いているときの id */
const ALL = 'all';

const EXEC_LINE: Line = {
  id: EXEC.id, name: EXEC.name, en: EXEC.en, state: '', color: EXEC.color, seed: 5,
  lead: EXEC.lead, can: EXEC.can, canMore: EXEC.canMore, model: EXEC.model, effort: EXEC.effort,
  rules: [], sub: '会社に1人。止めることも外すこともできません',
};

const toLine = (e: LiveEmployee): Line => {
  const d = definitionOf(e.definitionId);
  return {
    id: e.id, name: e.name, en: d?.en ?? '', state: e.state === 'running' ? '実行中' : '待機',
    color: e.color, seed: e.name.length * 7 + 3,
    lead: d?.mission ?? '', can: (d?.rules ?? []).slice(0, 3).map((r) => r.split('。')[0]),
    canMore: Math.max(0, (d?.rules.length ?? 0) - 3), model: MODEL_LABEL, effort: 2,
    rules: d?.rules ?? [],
    sub: e.hiredAt ? `${e.hiredAt.slice(0, 10)} から在籍` : undefined,
  };
};

/** まだいない人。ロスターの定義だけを持つ行（在籍の行と同じ形で並べる） */
const toCand = (d: Definition): Line => ({
  id: `d-${d.slug}`, name: d.name, en: d.en, state: '', color: AGENT_COLOR[d.color],
  seed: d.name.length * 9 + 5, lead: d.mission,
  can: d.rules.slice(0, 3).map((r) => r.split('。')[0]),
  canMore: Math.max(0, d.rules.length - 3), model: MODEL_LABEL, effort: 2,
  rules: d.rules, cand: d.slug,
});

export default function TeamPage() {
  /** 在籍（採用した社員）。store がひとつの出どころ */
  const [staff, setStaff] = useState<LiveEmployee[] | null>(null);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  useEffect(() => {
    let on = true;
    listEmployees().then((s) => { if (on) setStaff(s); });
    skillsList().then((s) => { if (on) setSkills(s); });
    return () => { on = false; };
  }, []);

  const { say5 } = useShell();
  // 右は閉じた状態から始まる。行か歯車を押すと、その1人ぶんだけ開く
  const [openId, setOpenId] = useOpen();
  const lines = (staff ?? []).map(toLine);
  /** **候補 ＝ ロスターの定義 − いまの在籍。** 採用は定義で採るので、同じ担当が2人にならない */
  const taken = new Set((staff ?? []).map((e) => slugOf(e.definitionId)));
  const cands = (staff === null ? [] : ROSTER.filter((d) => !taken.has(d.slug))).map(toCand);
  const sel = [...lines, ...cands].find((l) => l.id === openId) ?? null;
  const execOn = openId === EXEC.id;
  const allOn = openId === ALL;
  const shared = skills.filter((s) => s.scope === 'company');

  const take = async (l: Line) => {
    if (!l.cand) return;
    const r = await hire(l.cand, l.name);
    say5(r.ok ? `${l.name} を採用しました` : r.message ?? '採用できませんでした');
    if (r.ok && openId === l.id) setOpenId(null);
    listEmployees().then(setStaff);
  };

  return (
    <>
      <Centre>
        <TopBar title="メンバー" onPanel={() => setOpenId(EXEC.id)} panelOn={!!openId} />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: `18px 30px ${COMPOSER_H}px` }}>
          {/* 答えを先に1行 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 16 }}>
            <span style={{ fontSize: 16, lineHeight: '26px' }}>
              {lines.length > 0
                ? <>AI社員 {lines.length}人。統括AIが采配します。</>
                : <>AI社員はまだいません。Work を立てると、統括AIが採用を提案します。</>}
            </span>
          </div>

          {/* 統括AI は社員より上。設定はできるが、止めることも外すこともできない */}
          <Row l={EXEC_LINE} top on={execOn} onOpen={() => setOpenId(EXEC.id)} />
          <div style={{ height: 1, background: RULE }} />

          {lines.map((l) => (
            <Row key={l.id} l={l} on={openId === l.id} onOpen={() => setOpenId(l.id)} />
          ))}

          {/* **まだいない人。** 同じ行の形のまま、暗く並べて右に採用する */}
          {cands.length > 0 && (
            <>
              {/* 在籍がいるときだけ挟む（誰もいない会社で線を2本重ねない） */}
              {lines.length > 0 && <div style={{ height: 1, background: SEAM }} />}
              <span style={{ display: 'block', padding: '17px 0 1px', color: T5, fontSize: 11 }}>まだいない</span>
              {cands.map((l) => (
                <Row key={l.id} l={l} on={openId === l.id}
                  onOpen={() => setOpenId(l.id)} onHire={() => take(l)} />
              ))}
            </>
          )}

          {/* 全員に効くもの。社員の行と同じ列から始める */}
          <div style={{ height: 1, background: SEAM }} />
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0 0' }}>
            <span style={{ width: 49, flexShrink: 0, color: T5, fontSize: 11 }}>全員</span>
            <span style={{ color: T3, fontSize: 12.5 }}>
              {shared.length ? shared.map((s) => s.name).join(' · ') : '会社ぜんぶのスキルはまだありません'}
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => setOpenId(ALL)} className="icob" aria-label="全員に効くスキルとルール" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
            }}>
              <Icon name="gear" color={T4} size={16} width={1.2} />
            </button>
          </div>
        </div>

        <Composer placeholder="統括AIに聞く" />
      </Centre>

      {/* **右ペインは1枚。** 社員も統括AIも全員も、同じ器で開く */}
      {(sel || execOn || allOn) && (
        <SettingsPane
          who={allOn ? 'all' : execOn ? 'exec' : sel?.cand ? 'candidate' : 'employee'}
          l={sel ?? EXEC_LINE}
          skills={skills}
          onHire={sel?.cand ? () => take(sel) : undefined}
          onToggle={async (id, on) => {
            setSkills((xs) => xs.map((x) => (x.id === id ? { ...x, on } : x)));
            await skillToggle(id, on);
          }}
          onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

/**
 * 1人ぶんの行。3段 — 名前 / 約束 / できること。
 * 右にモデルと深さを縦に積み、いちばん右に歯車を**名前の行に上揃え**で置く。
 *
 * **まだいない人も同じ行で描く。** 違うのは2つだけ —
 * 全体を暗くする（在籍と見間違えない）／ 右はモデルと歯車ではなく `採用する`。
 */
function Row({ l, on, onOpen, onHire, top }: {
  l: Line; on?: boolean; onOpen?: () => void; onHire?: () => void; top?: boolean;
}) {
  const press = onOpen ? pressable(onOpen) : {};
  const cand = !!l.cand;
  return (
    <div className={onOpen ? 'row' : undefined} {...press} style={{
      display: 'flex', gap: 13, padding: '17px 0',
      borderTop: top ? undefined : `1px solid ${SEAM}`,
      background: on ? '#0C0C0C' : undefined,
      boxShadow: on ? `inset 3px 0 0 ${l.color}` : undefined,
      opacity: cand && !on ? 0.58 : undefined,
    }}>
      <Orb color={l.color} size={40} seed={l.seed} dim={cand || l.state === '待機'} />
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

          {/* まだいない人に、モデルも深さも設定も無い。**あるのは採る/採らないだけ** */}
          {cand ? (
            <button onClick={(e) => { e.stopPropagation(); onHire?.(); }} className="btn" style={{
              display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 15px', borderRadius: 8,
              background: 'transparent', border: `1px solid ${RULE}`, color: T3,
              whiteSpace: 'nowrap', flexShrink: 0, marginTop: -1,
            }}>採用する</button>
          ) : (
          /* モデルと深さ。**別々の操作**で、右に縦に積む。どちらも枠を持たない */
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
          )}
        </div>
      </div>
    </div>
  );
}

/** 状態は点＋素の文字（ふつうの状態なのでピルにしない）。無いなら出さない */
function StateMark({ state }: { state: string }) {
  if (!state) return null;
  const dot = state === '実行中' ? GREEN : MUTE;
  const text = state === '実行中' ? GREEN_T : T4;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }} />
      <span style={{ color: text, fontSize: 12 }}>{state}</span>
    </span>
  );
}

/**
 * 設定のペイン。**社員も統括AIも「全員に効くこと」も、同じ器で開く。**
 *
 * 違うのは4つだけ —
 *   ・統括AI は**止められない**（会社に1人しかいない）
 *   ・全員に効くことは**人ではない**ので、モデルも深さも一時停止も持たない
 *   ・**まだいない人**は、読むだけ（約束と守ること）＋ 採用する。設定するものがまだ無い
 *   ・ルール＝定義の Critical Rules（社長は消せない）
 *
 * **保存ボタンを置かない**（トグルはその場で効く）。道具は社長に触らせない。
 */
function SettingsPane({ who, l, skills, onToggle, onHire, onClose }: {
  who: 'employee' | 'exec' | 'all' | 'candidate'; l: Line; skills: SkillRow[];
  onToggle: (id: string, on: boolean) => void; onHire?: () => void; onClose: () => void;
}) {
  const { say5 } = useShell();
  const cand = who === 'candidate';
  // 全員に効くことを見ているときは、会社ぜんぶのスキルだけ
  const list = who === 'all' ? skills.filter((s) => s.scope === 'company') : skills;
  const title = who === 'all' ? '全員に効くこと' : who === 'exec' ? '統括AIの設定'
    : cand ? 'まだいない人' : 'AI社員の設定';

  return (
    <Pane width={430} icon={cand ? 'team' : 'gear'} title={title} onClose={onClose}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 18px 24px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        {who !== 'all' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Orb color={l.color} size={44} seed={l.seed} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                <span style={{ fontSize: 15 }}>{l.name}</span>
                <span style={{ color: '#454545', fontSize: 11 }}>{l.en}</span>
              </div>
              {l.sub && <span style={{ color: T5, fontSize: 11.5 }}>{l.sub}</span>}
            </div>
          </div>
        )}
        {who === 'all' && (
          <span style={{ color: T3, fontSize: 13, lineHeight: '21px' }}>
            ここに入れたものは、統括AIと全部のAI社員に効きます。
          </span>
        )}
        {cand && <span style={{ color: T2, fontSize: 13.5, lineHeight: '22px' }}>{l.lead}</span>}

        {!cand && <Section label={who === 'all' ? '会社ぜんぶのスキル' : 'スキル'} right={
          <button onClick={() => say5('スキルの追加はスキル画面から。読み込みの口は次のフェーズで繋がります')}
            className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T4, fontSize: 12 }}>
            <Icon name="plus" color={T4} size={12} />追加
          </button>
        }>
          {list.length === 0 && (
            <span style={{ display: 'block', padding: '10px 0', color: T5, fontSize: 12.5 }}>
              まだありません。SKILL.md を読み込むと、必要なときだけ社員が読みます
            </span>
          )}
          {list.map((s, i) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0',
              borderBottom: i === list.length - 1 ? undefined : `1px solid ${HAIR}`,
            }}>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ color: T5, fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>{s.filename}</span>
              </div>
              <div style={{ flex: 1 }} />
              <span {...pressable(() => onToggle(s.id, !s.on))}><Toggle on={s.on} /></span>
            </div>
          ))}
        </Section>}

        {/* 学び＝この社員が仕事から書き溜めたメモ。**次の実行の依頼文に載る**。
            ルールにするかは社長が決める（自動では昇格しない） */}
        {who === 'employee' && <Learnings employeeId={l.id} />}

        {/* ルール＝毎回効く制約。定義の Critical Rules は消せない */}
        {(who === 'employee' || cand) && l.rules.length > 0 && (
          <Section label={cand ? '守ること' : 'ルール'}>
            {l.rules.map((r, i) => (
              <div key={r} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0 10px 11px',
                borderLeft: `2px solid ${RULE}`,
                borderBottom: i === l.rules.length - 1 ? undefined : `1px solid ${HAIR}`,
              }}>
                <span style={{ color: T2, fontSize: 12.5, lineHeight: '19px' }}>{r}</span>
              </div>
            ))}
            {!cand && (
              <span style={{ display: 'block', paddingTop: 8, color: T5, fontSize: 11.5 }}>
                定義のルールは消せません。足すのは統括AIとの相談から
              </span>
            )}
          </Section>
        )}

        {/* 人ではないもの・まだいない人に、モデルと深さは無い */}
        {who !== 'all' && !cand && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: T3 }}>モデル</span>
              <div style={{ flex: 1 }} />
              <ModelInline value={l.model} models={MODELS} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: T3 }}>思考の深さ</span>
              <div style={{ flex: 1 }} />
              <EffortInline value={l.effort} words={EFFORT_WORDS} />
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
            <button onClick={() => say5('一時停止は次のフェーズで繋がります')} className="btn" style={{
              display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 12px',
              borderRadius: 8, border: `1px solid ${EDGE}`, color: T3, fontSize: 12,
            }}>一時停止</button>
          </div>
        )}
      </div>

      {/* **まだいない人の行動は1つ。** 青は1ペインに1つなので、ここだけが青 */}
      {cand && (
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: 16, borderTop: `1px solid ${HAIR}` }}>
          <button onClick={onHire} className="solid" style={{
            display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 18px',
            borderRadius: 8, background: BLUE, color: '#fff', fontSize: 13,
          }}>採用する</button>
        </div>
      )}
    </Pane>
  );
}

/**
 * 学び。実行の終わりに社員が note_learning で書き溜めたもの（最大30行）。
 * **見える・消せる** — 見えないところで社員が変わっていかないための欄。
 * ルールへの昇格は自動でしない（ルールは毎回効く制約。増やすのは社長の判断）。
 */
function Learnings({ employeeId }: { employeeId: string }) {
  const [lines, setLines] = useState<string[] | null>(null);
  useEffect(() => {
    let on = true;
    learningsGet(employeeId).then((ls) => { if (on) setLines(ls); });
    return () => { on = false; };
  }, [employeeId]);

  const drop = async (i: number) => {
    const next = (lines ?? []).filter((_, k) => k !== i);
    setLines(next);
    await learningsSet(employeeId, next);
  };

  if (!lines || lines.length === 0) return null; // まだ無いなら節ごと出さない
  return (
    <Section label="学び">
      {lines.map((r, i) => (
        <div key={`${i}-${r}`} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
          borderBottom: i === lines.length - 1 ? undefined : `1px solid ${HAIR}`,
        }}>
          <span style={{ color: T2, fontSize: 12.5, lineHeight: '19px' }}>{r}</span>
          <div style={{ flex: 1 }} />
          <button className="icob" title="この学びを消す" style={{ display: 'inline-flex', padding: 3, flexShrink: 0 }}
            onClick={() => drop(i)}>
            <Icon name="close" color={DIM} size={12} />
          </button>
        </div>
      ))}
      <span style={{ display: 'block', paddingTop: 8, color: T5, fontSize: 11.5 }}>
        仕事の終わりに社員が書き溜めます。次の実行の依頼文に載る — 合わないものは消してください
      </span>
    </Section>
  );
}
