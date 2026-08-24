'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { useParam } from '@/lib/use-open';
import { Ask, Chips, Composer, ExecStatus, TopBar } from '@/components/shell/Chrome';
import { conditionChips } from '@/lib/live/conditions';
import { discoveryGet, discoveryStep } from '@/app/actions/entry';
import type { Conditions, Question } from '@/lib/exec/types';
import { RED_T, T5 } from '@/lib/design/tokens';
/**
 * ⓪-a 条件を集める（Case B）。**統括AIが本当に聞き、本当に候補を出す。**
 *
 * ・条件は構造で持つ（`discovery_sessions.constraints`）。チップは store の実物
 * ・質問は板で出す（統括AIの `ask`）。答えると「質問 → 答え」の形で渡し直す
 * ・条件が2つそろうと候補3つ（`propose_candidates`）→ 候補をくらべる画面へ
 * ・**やりとりの文面は残さない** — 残るのは条件と候補（構造）。会話の置き場はチャット
 * ・`?edit=1` で来たら、候補が出ていてもここに留まる（**条件を直して出し直せる**）
 */

function Discovery() {
  const router = useRouter();
  // 探索の1回は URL に持つ（読み込み直しても同じ探索の続き）
  const [sid, setSid] = useParam('s', '');
  const [edit] = useParam('edit', '');
  const [cond, setCond] = useState<Conditions>({ strengths: [], avoid: [] });
  const [qs, setQs] = useState<Question[]>([]);
  const [qi, setQi] = useState(0);
  const [said, setSaid] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const [fake, setFake] = useState(false);

  /**
   * 途中から開いたら、集めた条件を読み戻す。もう候補が出ていれば結果へ。
   * **ただし「条件を変える」で来たとき（`?edit=1`）は留まる** —
   * 留まらないと、結果画面の「条件を変える」がその場で跳ね返って、
   * 条件を直す道が1本も無くなる（候補を出し直す前提が切れる）。
   */
  useEffect(() => {
    if (!sid) return;
    let on = true;
    discoveryGet(sid).then((d) => {
      if (!on || !d) return;
      if (!edit && (d.status === 'proposed' || d.status === 'adopted')) {
        router.replace(`/discovery/result?s=${sid}` as Route);
        return;
      }
      setCond(d.conditions);
      setFake(!d.real);
    });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 探索は1つ。二度押しで「まだ探索が無い」を2回見ると、条件が2つの探索に散る。
   * **id は ref で持つ**（state の反映を待たない）、走っている間は入らない。
   */
  const sidRef = useRef(sid);
  useEffect(() => { if (sid) sidRef.current = sid; }, [sid]);
  const running = useRef(false);

  const step = async (text: string, force: boolean) => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setFail('');
    if (text) setSaid((xs) => [...xs.slice(-3), text]);
    /**
     * **倒れても入力欄を返す。** 投げたまま（catch 無し）だと busy が true のまま残り、
     * 「考えています」で固まって二度と書けない（Composer は busy で送信を弾く）
     */
    const r = await discoveryStep(sidRef.current || null, text, force || /もう(候補を)?出して/.test(text))
      .catch(() => ({ ok: false as const, message: '統括AIに届きませんでした。もう一度お試しください' }))
      .finally(() => { running.current = false; });
    if (!r.ok) { setBusy(false); setFail(r.message); return; }
    sidRef.current = r.id;
    /**
     * **移るときは、この画面の URL を書かない。**
     * `setSid` は「描き終わってから `history.replaceState`」で URL を書く（→ `useParam`）。
     * これを `router.push` の前に置くと、**遷移したあとに書き戻して行き先を潰す** —
     * 最初の1通で条件が2つそろうと、「考えています」のまま二度と進まなくなっていた。
     */
    if (r.kind === 'proposed') { router.push(`/discovery/result?s=${r.id}` as Route); return; }
    if (!sid) setSid(r.id);
    setFake(!r.real);
    setCond(r.conditions);
    setQs(r.questions); setQi(0);
    setBusy(false);
  };

  const q = qs[qi];
  const chips = conditionChips(cond);

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      {/* **「条件 N / 5」は置かない。** 5 は項目数であって目標ではないし、
          本文の「2つそろったら」と食い違う（存在しない目標を数字で見せる）。
          何件あるかはチップが言っている */}
      <TopBar title="何をやるか決める" />
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
        {/* **「確認したいことがあります」は置かない。** 真下の板が質問そのものを出している
            （二度言い）。橙は 判断待ち / 要確認 の2つだけの色で、条件を聞くのはどちらでもない */}
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
