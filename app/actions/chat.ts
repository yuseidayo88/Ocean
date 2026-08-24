'use server';

import { chatStep, type ChatState } from '@/lib/exec/chat';
import { store, type ChatCard, type LiveWork } from '@/lib/store';
import type { Conditions } from '@/lib/exec/types';
import { sayError } from '@/lib/errors';
import { startWork, type StartResult } from './work';

/**
 * チャットの口。**入口も相談も、ここが受ける**（2026-08-24 の作り直し）。
 *
 * ・`/start` の3つの入口は、どれも**新しいチャットを作って**そこから始まる
 * ・統括AIの返事には**カード**が付く（質問 / 候補3つ / 診断 / Work を作る確認）
 * ・**1チャット = 1 Work。** 作る前に必ず社長の確認を挟む
 */

/** 会社のいまを1枚に畳む（Work をまたいだ相談に答えるため） */
async function snapshot(): Promise<string> {
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

/** 入口の3つ。**どれも新しいチャットになる** */
export type Entry = 'goal' | 'discovery' | 'import';

/** その入口の最初の一言（社長の側の発言として置く。統括AIが道を見分ける手がかり） */
const OPENER: Record<Entry, string> = {
  goal: '',
  discovery: '何をやればいいか、まだ決まっていません。条件から一緒に決めたいです。',
  import: 'すでに事業があります。いまの状態を見てもらって、次にやることを決めたいです。',
};

/**
 * チャットの見出し。**入口から始めたものには短い名前を付ける** —
 * 最初の一言をそのまま見出しにすると、左レールで切れて読めなくなる
 * （レールは 260px。入るのは16文字ほど）。
 */
const TITLE: Record<Entry, string | undefined> = {
  goal: undefined,          // 書いたゴールの先頭を使う（store が刻む）
  discovery: '何をやるか決める',
  import: '事業を見てもらう',
};

export type SendResult =
  | { ok: true; threadId: string }
  | { ok: false; message: string };

/**
 * 書いたものを送って、統括AIに返してもらう。
 * `threadId` が null なら**新しいチャットを作る**（「始めますか」から書いたとき）。
 */
export async function chatSend(threadId: string | null, text: string, title?: string): Promise<SendResult> {
  const body = text.trim();
  if (!body) return { ok: false, message: '書いてから送ってください' };
  const s = store();
  let id = threadId;
  try {
    id = await s.addChat(threadId, 'user', body, title);
  } catch (e) {
    return { ok: false, message: sayError(e, '送れませんでした') };
  }

  try {
    const t = await s.getThread(id);
    if (!t) return { ok: false, message: 'このチャットは見つかりませんでした' };

    // いまのスレッドの状態を畳む
    const disc = t.thread.discoveryId ? await s.getDiscovery(t.thread.discoveryId) : null;
    const prof = t.thread.profileId ? await s.getProfile(t.thread.profileId) : null;
    const state: ChatState = {
      hasWork: !!t.thread.workId,
      conditions: disc?.conditions,
      proposed: !!disc?.candidates.length,
      materials: (prof?.sources ?? []).map((x) => x.locator),
      diagnosed: !!prof?.diagnosis,
      company: await snapshot(),
    };

    const history = t.messages.slice(-10).map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.body,
    }));

    const out = await chatStep(state, history);

    /* ── 書く。**カードは1枚だけ**（候補 → 診断 → Work → 質問 の順に強い） ── */
    let card: ChatCard | undefined;

    // まだ決まっていない人の道
    if (Object.keys(out.conditions).length || out.candidates.length) {
      let sid = t.thread.discoveryId;
      if (!sid) { sid = await s.createDiscovery(); await s.linkThread(id, { discoveryId: sid }); }
      const before = disc?.conditions ?? { strengths: [], avoid: [] };
      const merged: Conditions = {
        hoursPerWeek: out.conditions.hoursPerWeek ?? before.hoursPerWeek ?? null,
        budgetJpy: out.conditions.budgetJpy ?? before.budgetJpy ?? null,
        strengths: out.conditions.strengths ?? before.strengths,
        avoid: out.conditions.avoid ?? before.avoid,
        deadline: out.conditions.deadline ?? before.deadline ?? null,
      };
      await s.setConditions(sid, merged, out.real);
      if (out.candidates.length) {
        await s.setCandidates(sid, out.candidates);
        card = { kind: 'candidates', sessionId: sid };
      }
    }

    // すでに事業がある人の道
    if (out.materials.length || out.findings.length || out.business) {
      let pid = t.thread.profileId;
      if (!pid) { pid = await s.createProfile(out.business?.name || 'わたしの事業'); await s.linkThread(id, { profileId: pid }); }
      for (const m of out.materials) {
        await s.addSource(pid, { kind: m.kind, locator: m.locator, summary: m.content, status: m.content ? 'done' : 'queued' });
      }
      if (out.business?.name || out.business?.stage) await s.setProfileMeta(pid, out.business);
      if (out.findings.length) {
        await s.saveDiagnosis(pid, { facts: out.facts, findings: out.findings, real: out.real });
        card ??= { kind: 'diagnosis', profileId: pid };
      }
    }

    if (!card && out.work) card = { kind: 'work', ...out.work };
    if (!card && out.questions.length) card = { kind: 'ask', questions: out.questions };

    const say = out.text || (card ? '' : '（返事がありませんでした）');
    if (say || card) await s.addChat(id, 'executive', say, undefined, card);
    return { ok: true, threadId: id };
  } catch (e) {
    // **倒れても、社長の発言は残っている。** 返事の代わりに理由を置く
    const message = sayError(e, '統括AIが応えませんでした');
    await s.addChat(id, 'executive', `うまく応えられませんでした — ${message}`).catch(() => {});
    return { ok: false, message };
  }
}

/** 入口から新しいチャットを始める。返り値は新しいスレッド id */
export async function chatStart(entry: Entry, text?: string): Promise<SendResult> {
  const first = entry === 'goal' ? (text ?? '').trim() : OPENER[entry];
  if (!first) return { ok: false, message: 'やりたいことを書いてください' };
  return chatSend(null, first, TITLE[entry]);
}

/**
 * **Work を作る**（カードの「作る」を押したとき）。
 * ここで初めて Work ができる。**1チャット=1Work** は `linkThread` が最後に守る。
 */
export async function chatMakeWork(
  threadId: string, w: { title: string; goal: string; weeks: number },
): Promise<StartResult> {
  try {
    const s = store();
    const t = await s.getThread(threadId);
    if (!t) return { ok: false, need: 'error', message: 'このチャットは見つかりませんでした' };
    if (t.thread.workId) return { ok: true, id: t.thread.workId, real: true };

    const goal = [`${w.title}をやりたい`, `終わり: ${w.goal}`,
                  w.weeks ? `見込み: およそ${w.weeks}週` : ''].filter(Boolean).join('\n');
    const r = await startWork(goal);
    if (!r.ok) return r;
    // 取れなかった＝別のタブが先に作った。そちらを指す（2本目を立てない）
    const mine = await s.linkThread(threadId, { workId: r.id });
    const fresh = mine ? r.id : (await s.getThread(threadId))?.thread.workId ?? r.id;
    await s.addChat(threadId, 'executive', `Work「${w.title}」を作りました。計画を見て、承認してください。`);
    return { ...r, id: fresh };
  } catch (e) {
    return { ok: false, need: 'error', message: sayError(e, 'Work を作れませんでした') };
  }
}

/* ══════════════ 宛先（どの Work の会話に書くか）══════════════ */

/**
 * 入力欄の宛先の候補。**Work の名前を並べ、いちばん下に「新しいチャット」**。
 * 終わった Work は出さない（もう相談することが無い）。
 */
export async function chatTargets(): Promise<{ id: string; title: string }[]> {
  try {
    return (await store().listWorks())
      .filter((w) => w.status !== 'archived' && w.status !== 'done')
      .map((w) => ({ id: w.id, title: w.title }));
  } catch {
    return [];
  }
}

/**
 * その Work の会話を開く（無ければ作る）。
 * **選んだ先が必ず1本ある**ようにするので、押して何も起きない、が起きない。
 */
export async function openWorkChat(
  workId: string,
): Promise<{ ok: true; threadId: string } | { ok: false; message: string }> {
  try {
    return { ok: true, threadId: await store().threadForWork(workId) };
  } catch (e) {
    return { ok: false, message: sayError(e, 'その Work の会話を開けませんでした') };
  }
}
