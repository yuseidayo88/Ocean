'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useParam } from '@/lib/use-open';
import { Ask, Chips, Composer, ExecStatus, TopBar } from '@/components/shell/Chrome';
import { Dot } from '@/components/ui/Icon';
import { discoveryGet, discoveryStep } from '@/app/actions/entry';
import type { Conditions, Question } from '@/lib/exec/types';
import { AMBER, AMBER_T, RED_T, T5 } from '@/lib/design/tokens';
/**
 * ⓪-a 条件を集める（Case B）。**統括AIが本当に聞き、本当に候補を出す。**
 *
 * ・条件は構造で持つ（`discovery_sessions.constraints`）。チップは store の実物
 * ・質問は板で出す（統括AIの `ask`）。答えると「質問 → 答え」の形で渡し直す
 * ・条件が2つそろうと候補3つ（`propose_candidates`）→ 候補をくらべる画面へ
 * ・**やりとりの文面は残さない** — 残るのは条件と候補（構造）。会話の置き場はチャット
 */

/** 集めた条件 → チップの並び。**無いものは出さない** */
function chipsOf(c: Conditions): [string, string][] {
  const out: [string, string][] = [];
  if (c.hoursPerWeek != null) out.push(['時間', `週${c.hoursPerWeek}時間`]);
  if (c.budgetJpy != null) out.push(['資金', `〜${Math.round(c.budgetJpy / 10000)}万円`]);
  if (c.strengths.length) out.push(['得意', c.strengths.join(' · ')]);
  if (c.avoid.length) out.push(['避ける', c.avoid.join(' · ')]);
  if (c.deadline) out.push(['期限', c.deadline]);
  return out;
}

function Discovery() {
  const router = useRouter();
  // 探索の1回は URL に持つ（読み込み直しても同じ探索の続き）
  const [sid, setSid] = useParam('s', '');
  const [cond, setCond] = useState<Conditions>({ strengths: [], avoid: [] });
  const [qs, setQs] = useState<Question[]>([]);
  const [qi, setQi] = useState(0);
  const [said, setSaid] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const [fake, setFake] = useState(false);

  // 途中から開いたら、集めた条件を読み戻す。もう候補が出ていれば結果へ
  useEffect(() => {
    if (!sid) return;
    let on = true;
    discoveryGet(sid).then((d) => {
      if (!on || !d) return;
      if (d.status === 'proposed' || d.status === 'adopted') {
        router.replace(`/discovery/result?s=${sid}` as Route);
        return;
      }
      setCond(d.conditions);
      setFake(!d.real);
    });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = async (text: string, force: boolean) => {
    setBusy(true); setFail('');
    if (text) setSaid((xs) => [...xs.slice(-3), text]);
    const r = await discoveryStep(sid || null, text, force || /もう(候補を)?出して/.test(text));
    if (!r.ok) { setBusy(false); setFail(r.message); return; }
    if (!sid) setSid(r.id);
    setFake(!r.real);
    if (r.kind === 'proposed') { router.push(`/discovery/result?s=${r.id}` as Route); return; }
    setCond(r.conditions);
    setQs(r.questions); setQi(0);
    setBusy(false);
  };

  const q = qs[qi];
  const chips = chipsOf(cond);

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title="何をやるか決める" right={
        chips.length ? <span style={{ color: T5, fontSize: 12 }} className="tnum">条件 {chips.length} / 5</span> : undefined
      } />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '22px 24px 0', overflowY: 'auto' }}>
        {/* 統括AIの発言にアバターは置かない（ChatGPT と同じ） */}
        <div style={{ width: '100%', maxWidth: 748 }}>
          <span style={{ fontSize: 15, lineHeight: '26px' }}>
            先に条件だけ教えてください。<b>全部でなくて構いません。</b>2つそろったら、候補を3つ出します。
          </span>
        </div>

        {/* 送ったことば（このやりとりの間だけ。残るのは下の条件のほう） */}
        {said.map((t, i) => (
          <div key={i} style={{ width: '100%', maxWidth: 748, display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ maxWidth: '78%', padding: '9px 16px', borderRadius: 18, background: '#24354A', color: '#DCE7F5' }}>{t}</span>
          </div>
        ))}

        {chips.length > 0 && <Chips items={chips} />}

        {busy && <ExecStatus state="thinking" />}
        {!busy && q && (
          <div style={{ width: '100%', maxWidth: 748, display: 'flex', alignItems: 'center', gap: 9 }}>
            <Dot color={AMBER} size={7} />
            <span style={{ color: AMBER_T, fontSize: 12.5 }}>確認したいことがあります</span>
          </div>
        )}
        {fail && <span style={{ color: RED_T, fontSize: 12.5 }}>{fail}</span>}
        {fake && (
          <span style={{ color: T5, fontSize: 12 }}>
            これは仮のやりとりです。モデルの鍵がまだ入っていないので、統括AIは考えていません
          </span>
        )}

        {/* 条件が1つでもあれば、待たずに出させる口を置く（統括AIの判断を待たなくていい） */}
        {!busy && chips.length > 0 && !q && (
          <button className="lnk" onClick={() => step('', true)} style={{ color: T5, fontSize: 12.5 }}>
            この条件で候補を出す ›
          </button>
        )}
        <div style={{ flex: 1 }} />
      </div>
      <Composer placeholder="条件を足す、または「もう出して」" busy={busy}
        onSend={(t) => step(t, false)}
        above={q && !busy
          ? <Ask q={q.body} idx={qi + 1} total={qs.length}
              options={q.options.map((o) => ({ label: o.label, note: o.description, recommended: o.recommended }))}
              free="自分の言葉で書く" busy={busy}
              onPick={(label) => step(`${q.body} → ${label}`, false)}
              onFree={(text) => step(`${q.body} → ${text}`, false)}
              onSkip={() => (qi + 1 < qs.length ? setQi(qi + 1) : setQs([]))}
              onMove={(d) => setQi(Math.max(0, Math.min(qs.length - 1, qi + d)))} />
          : undefined} />
    </div>
  );
}

export default function DiscoveryPage() {
  // useSearchParams（useParam の中）は Suspense の内側でしか使えない
  return <Suspense fallback={null}><Discovery /></Suspense>;
}
