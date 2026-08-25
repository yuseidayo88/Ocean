'use server';

import { replyTo } from '@/lib/exec/reply';
import { OPENER, TITLE, type Entry } from '@/lib/exec/openers';
import { store } from '@/lib/store';
import { sayError } from '@/lib/errors';
import { startWork, type StartResult } from './work';

/**
 * チャットの口。**入口も相談も、ここが受ける**（2026-08-24 の作り直し）。
 *
 * ・`/start` の3つの入口は、どれも**新しいチャットを作って**そこから始まる
 * ・統括AIの返事には**カード**が付く（質問 / 候補3つ / 診断 / Work を作る確認）
 * ・**1チャット = 1 Work。** 作る前に必ず社長の確認を挟む
 */

export type SendResult =
  | { ok: true; threadId: string }
  | { ok: false; message: string };

/**
 * **書くだけ。** モデルを待たずに返るので、押した瞬間に会話が始められる。
 * `threadId` が null なら**新しいチャットを作る**（「始めますか」から書いたとき）。
 *
 * 送るのと返してもらうのを**2つに分けている**のは、押した瞬間に会話の中へ入るため。
 * 前は1本で、モデルが返すまで `/start` に立ったままだった（押しても何も起きない、に見える）。
 * 返事は `chatReply` が別に取りに行く（画面はもう会話の中にいて、考えていると出ている）。
 */
export async function chatSay(
  threadId: string | null, text: string, title?: string,
): Promise<SendResult> {
  const body = text.trim();
  if (!body) return { ok: false, message: '書いてから送ってください' };
  try {
    return { ok: true, threadId: await store().addChat(threadId, 'user', body, title) };
  } catch (e) {
    return { ok: false, message: sayError(e, '送れませんでした') };
  }
}

/**
 * 統括AIに返してもらう（流さない道）。中身は `lib/exec/reply.ts`。
 * ふだん画面が使うのは**流す道**（`/api/chat`）で、こちらは保険と検査のため。
 */
export async function chatReply(id: string): Promise<SendResult> {
  const r = await replyTo(id);
  return r.ok ? { ok: true, threadId: id } : { ok: false, message: r.message };
}

/** 入口から新しいチャットを始める。返り値は新しいスレッド id */
export async function chatStart(entry: Entry, text?: string): Promise<SendResult> {
  const first = entry === 'goal' ? (text ?? '').trim() : OPENER[entry];
  if (!first) return { ok: false, message: 'やりたいことを書いてください' };
  // **返事は待たない。** 会話の画面が開いてから取りに行く
  const r = await chatSay(null, first, TITLE[entry]);
  /**
   * 「まだ決まっていない」は、**この時点で探索の器を作って結びつける。**
   * 前は最初の往復が条件を書いたときに作られていたので、モデルが文章だけ返すと
   * 器が無いままになり、「会話を止めない」仕掛け（→ `lib/exec/reply.ts`）が眠っていた。
   * 器はここで必ずできるので、探索の会話は**最初から最後まで**その保証の中にいる。
   */
  if (r.ok && entry === 'discovery') {
    try {
      const s = store();
      const sid = await s.createDiscovery();
      await s.linkThread(r.threadId, { discoveryId: sid });
    } catch { /* 器が作れなくても会話は始まる（前と同じ、遅れて作られる道が残る） */ }
  }
  return r;
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

    /**
     * **吹き出しに出るのは社長が決めたことだけ**（→ `startWork(goal, ctx)`）。
     * 前はここが3行を1つに繋いでいたので、Work 画面のゴール行に
     * 「◯◯をやりたい 終わり: … 見込み: およそ10週」が
     * **社長の言葉として**出ていた（計画の吹き出しでは直したのに、ここが残っていた）。
     * 終わりの形と見込みは、統括AIにだけ渡す。
     */
    const ctx = [`Work の題: ${w.title}`, w.weeks ? `見込み: およそ${w.weeks}週` : '']
      .filter(Boolean).join('\n');
    const r = await startWork(w.goal, ctx);
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
