import { chatStep, type ChatOut, type ChatState } from './chat';
import { store, type ChatCard, type LiveWork } from '@/lib/store';
import type { Conditions } from './types';
import { isOpener } from './openers';
import { sayError } from '@/lib/errors';

/**
 * **統括AIに返してもらう1回**（書くのはもう終わっている）。
 *
 * ここが本体で、呼び口は2つある —
 *   ・`app/api/chat/route.ts`（**流しながら**返す。画面は最初の1文字から出せる）
 *   ・`app/actions/chat.ts` の `chatReply`（流さない道。検査と保険）
 *
 * どちらも同じ順で同じことをする。**分けて書くと、片方だけ直る。**
 */

/** 会社のいまを1枚に畳む（Work をまたいだ相談に答えるため） */
export async function snapshot(): Promise<string> {
  const s = store();
  const works = await s.listWorks().catch(() => [] as LiveWork[]);
  const lines = works.length
    ? works.map((w) => {
        const at = w.phases.find((p) => p.state === 'active' || p.state === 'review');
        return `- ${w.title}（${w.status === 'paused' ? '停止中' : at ? `フェーズ${at.seq}: ${at.name}` : w.status}）`;
      })
    : ['- まだ Work はありません'];
  const decided = (await s.listDecisions().catch(() => []))
    .filter((d) => d.status === 'decided' && d.chosen).slice(0, 5);
  if (decided.length) {
    lines.push('', '決めたこと:');
    for (const d of decided) lines.push(`- ${d.question} → ${d.chosen}`);
  }
  return lines.join('\n');
}

/**
 * `missing` ＝ そのスレッドが**この実行環境からは見えなかった**。
 * 呼んだ側が「あるはず」と知っているなら、道が悪い（→ `app/api/chat/route.ts`）。
 */
export type ReplyResult = { ok: true } | { ok: false; message: string; missing?: true };

/** そろっている条件の数（値が入っているもの） */
const filled = (c: Conditions) =>
  [c.interests.length || null, c.hoursPerWeek, c.budgetJpy,
   c.strengths.length || null, c.avoid.length || null, c.deadline]
    .filter((v) => v !== null && v !== undefined).length;

/**
 * **候補を出していいか。**
 * 分野（何の話か）が分からないまま出すと、「小さな実用品の販売所」のように
 * **何に関するものか誰にも分からない案**になる（実際そうなった）。
 * だから分野は必須。そのうえで、ほかの条件が2つ以上そろっていること。
 */
const canPropose = (c: Conditions | undefined) =>
  !!c && c.interests.length > 0 && filled(c) >= 3;

/**
 * `onText` は本文が1かたまり届くたびに呼ばれる（流す口のため）。
 * **書き込みは最後に1回**。途中で倒れたら、代わりに理由を1行残す。
 */
export async function replyTo(
  id: string, onText?: (t: string) => void, onStage?: (s: string) => void,
  onThink?: (t: string) => void,
): Promise<ReplyResult> {
  const s = store();
  try {
    const t = await s.getThread(id);
    if (!t) return { ok: false, message: 'このチャットは見つかりませんでした', missing: true };

    // いまのスレッドの状態を畳む
    const disc = t.thread.discoveryId ? await s.getDiscovery(t.thread.discoveryId) : null;
    const prof = t.thread.profileId ? await s.getProfile(t.thread.profileId) : null;
    // **入口の一言で始まった往復は、必ずカードになる**（→ `lib/exec/openers.ts`）
    const last = t.messages[t.messages.length - 1];
    const state: ChatState = {
      hasWork: !!t.thread.workId,
      conditions: disc?.conditions,
      proposed: !!disc?.candidates.length,
      materials: (prof?.sources ?? []).map((x) => x.locator),
      diagnosed: !!prof?.diagnosis,
      company: await snapshot(),
      needCard: !!last && last.role === 'user' && isOpener(last.body),
      /**
       * **スレッドが知っていることを、最初から持たせる。**
       * 前は conditions を書いた往復の中でしか入らず、モデルが文章だけ返した往復の
       * あとは「続きの仕掛け」が丸ごと眠っていた（→ 会話が止まって見えた）。
       */
      discoveryId: t.thread.discoveryId,
      profileId: t.thread.profileId,
    };

    const history = t.messages.slice(-10).map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.body,
    }));

    /** 1往復ぶんを書き切って、出たカードを返す */
    const absorb = async (out: ChatOut): Promise<ChatCard | undefined> => {
      let card: ChatCard | undefined;

      // まだ決まっていない人の道
      if (Object.keys(out.conditions).length || out.candidates.length) {
        let sid = t.thread.discoveryId ?? state.discoveryId;
        if (!sid) { sid = await s.createDiscovery(); await s.linkThread(id, { discoveryId: sid }); }
        state.discoveryId = sid;
        const before: Conditions = state.conditions ?? { interests: [], strengths: [], avoid: [] };
        const merged: Conditions = {
          interests: out.conditions.interests ?? before.interests,
          hoursPerWeek: out.conditions.hoursPerWeek ?? before.hoursPerWeek ?? null,
          budgetJpy: out.conditions.budgetJpy ?? before.budgetJpy ?? null,
          strengths: out.conditions.strengths ?? before.strengths,
          avoid: out.conditions.avoid ?? before.avoid,
          deadline: out.conditions.deadline ?? before.deadline ?? null,
        };
        await s.setConditions(sid, merged, out.real);
        state.conditions = merged;         // 続きの往復は、いまの条件の上に載る
        if (out.candidates.length) {
          await s.setCandidates(sid, out.candidates);
          state.proposed = true;
          card = { kind: 'candidates', sessionId: sid };
        }
      }

      // すでに事業がある人の道
      if (out.materials.length || out.findings.length || out.business) {
        let pid = t.thread.profileId ?? state.profileId;
        if (!pid) { pid = await s.createProfile(out.business?.name || 'わたしの事業'); await s.linkThread(id, { profileId: pid }); }
        state.profileId = pid;
        for (const m of out.materials) {
          await s.addSource(pid, { kind: m.kind, locator: m.locator, summary: m.content, status: m.content ? 'done' : 'queued' });
        }
        if (out.business?.name || out.business?.stage) await s.setProfileMeta(pid, out.business);
        if (out.findings.length) {
          await s.saveDiagnosis(pid, { facts: out.facts, findings: out.findings, real: out.real });
          state.diagnosed = true;
          card ??= { kind: 'diagnosis', profileId: pid };
        }
      }

      if (!card && out.work) card = { kind: 'work', ...out.work };
      if (!card && out.questions.length) card = { kind: 'ask', questions: out.questions };

      if (out.text || card) await s.addChat(id, 'executive', out.text, undefined, card);
      return card;
    };

    const out = await chatStep(state, history, { onText, onStage, onThink });
    let card = await absorb(out);
    let saidSoFar = out.text;

    /**
     * **会話を止めない**（探索中のスレッドの決めごと）。
     *
     * 「まだ決まっていない」の会話では、統括AIの番は**必ず次の一手（カード）で終わる** —
     * 質問か、候補か。文章だけで終わると、社長は何を押せばいいのか分からず、
     * 会話がそこで死ぬ（実際「3案まだですか」と催促されて、はじめて動いた）。
     *
     * だから足りないぶんを**道具を1つに絞った往復**で補う（絞れば必ずその形になる）:
     *   1. 社長の答え（「質問 → 答え」）が来たのに条件に写っていない → **写す**（record）
     *   2. まだカードが無い → 条件がそろっていれば**候補**、足りなければ**質問**
     * 最大3往復（写す＋出す＋保険1回）。fast の浅い往復なので、体感は1呼吸。
     */
    if (state.discoveryId && !state.proposed) {
      const answered = !!last && last.role === 'user' && /→/.test(last.body);

      // 1. 答えが届いたのに、条件に写っていない
      if (answered && !Object.keys(out.conditions).length && !card) {
        onStage?.('答えを書き留めています');
        const rec = await chatStep(
          { ...state, push: 'record' },
          [...history, ...(saidSoFar ? [{ role: 'assistant' as const, content: saidSoFar }] : [])],
          { onText: undefined, onStage, onThink },   // 写すだけの往復の本文は画面に流さない
        );
        card = (await absorb(rec)) ?? card;
      }

      // 2. まだ次の一手が出ていない → 候補か質問を、道具を絞って必ず出す
      for (let i = 0; !card && i < 2; i++) {
        const ready = canPropose(state.conditions);
        onStage?.(ready ? '条件に合う道を組み立てています' : '聞くことをまとめています');
        const more = await chatStep(
          { ...state, needCard: true, push: ready ? 'candidates' : 'ask' },
          [...history, ...(saidSoFar ? [{ role: 'assistant' as const, content: saidSoFar }] : [])],
          { onText, onStage, onThink },
        );
        card = await absorb(more);
        saidSoFar = saidSoFar || more.text;
      }
    }

    return { ok: true };
  } catch (e) {
    // **倒れても、社長の発言は残っている。** 返事の代わりに理由を置く
    const message = sayError(e, '統括AIが応えませんでした');
    await s.addChat(id, 'executive', `うまく応えられませんでした — ${message}`).catch(() => {});
    return { ok: false, message };
  }
}
