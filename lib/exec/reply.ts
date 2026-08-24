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

/** そろっている条件の数（5項目のうち、値が入っているもの） */
const filled = (c: Conditions) =>
  [c.hoursPerWeek, c.budgetJpy, c.strengths.length || null, c.avoid.length || null, c.deadline]
    .filter((v) => v !== null && v !== undefined).length;

/**
 * `onText` は本文が1かたまり届くたびに呼ばれる（流す口のため）。
 * **書き込みは最後に1回**。途中で倒れたら、代わりに理由を1行残す。
 */
export async function replyTo(
  id: string, onText?: (t: string) => void, onStage?: (s: string) => void,
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
        const before = state.conditions ?? { strengths: [], avoid: [] };
        const merged: Conditions = {
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

    const out = await chatStep(state, history, { onText, onStage });
    const card = await absorb(out);

    /**
     * **止まらない。**
     *
     * 条件を書き留めただけで往復が終わると、画面には短い返事が1つ残るだけで
     * 何も進まない（実際「3案まだですか」と催促されて、はじめて出た）。
     * 道具は使ったのに**カードが1枚も出なかった**なら、それは話が途中で止まった往復。
     * そのまま**もう1回だけ**走らせる — 条件が足りなければ質問、そろっていれば候補になる。
     *
     * 1回だけ。ここで出なければ、社長の番に戻す。
     */
    if (!card && state.discoveryId && !state.proposed) {
      const ready = state.conditions ? filled(state.conditions) >= 3 : false;
      onStage?.(ready ? '条件に合う道を組み立てています' : '聞くことをまとめています');
      const more = await chatStep(
        { ...state, needCard: true, push: ready ? 'candidates' : 'ask' },
        [...history, { role: 'assistant', content: out.text || '（承知しました）' }],
        { onText, onStage },
      );
      await absorb(more);
    }

    return { ok: true };
  } catch (e) {
    // **倒れても、社長の発言は残っている。** 返事の代わりに理由を置く
    const message = sayError(e, '統括AIが応えませんでした');
    await s.addChat(id, 'executive', `うまく応えられませんでした — ${message}`).catch(() => {});
    return { ok: false, message };
  }
}
