'use server';

import { store, type Discovery, type Profile } from '@/lib/store';
import { sayError } from '@/lib/errors';
import { startWork, type StartResult } from './work';

/**
 * 入口（Case B / D）の残り。**会話そのものはチャットに移った**（→ `app/actions/chat.ts`）。
 * ここに残るのは、**チャットのカードが押されたときの行き先**だけ —
 * 候補を読む / 採用する / 診断を読む / 見つかったことを Work にする。
 */

/* ══════════════ Case B ══════════════ */



export async function discoveryGet(id: string): Promise<Discovery | null> {
  try { return await store().getDiscovery(id); } catch { return null; }
}

/**
 * 候補を採用して Work にする。ゴールは候補＋条件から組む（Case A と同じ道を通る）。
 * **選ばなかった候補は残る**（不変条件 9）。
 */
export async function adoptCandidate(
  sessionId: string, candidateId: string, threadId?: string, ending?: string,
): Promise<StartResult> {
  try {
    const s = store();
    const d = await s.getDiscovery(sessionId);
    const c = d?.candidates.find((x) => x.id === candidateId);
    if (!d || !c) return { ok: false, need: 'error', message: 'その候補は見つかりませんでした' };
    /**
     * **もう採用しているなら、そちらへ。** 古い表示のタブから別の候補を押しても、
     * 2本目の Work を作らない（deep の計画を二度払わない）。
     * ※ 同時押しのミリ秒の窓は残る — 完全に閉じるにはストア側の atomic claim（台帳に記載）。
     */
    const took = d.candidates.find((x) => x.adoptedWorkId);
    if (took?.adoptedWorkId) return { ok: true, id: took.adoptedWorkId, real: true };
    /**
     * **吹き出しに出るのは、社長が決めたことだけ。**
     * 「終わり」は候補が持っている（選ぶ前に読めるので、あとから聞き返さない。
     * `ending` は聞き返したときの答え＝保険）。
     */
    const goal = [
      `${c.name}を立ち上げたい`,
      ending || c.ending ? `終わり: ${ending || c.ending}` : '',
    ].filter(Boolean).join('\n');
    /** **背景と条件は統括AIにだけ渡す。** 計画はこれを読んで引かれる */
    const ctx = [
      `この道を選んだ理由: ${c.summary}`,
      d.conditions.interests.length ? `分野: ${d.conditions.interests.join('・')}` : '',
      d.conditions.hoursPerWeek ? `社長が使える時間: 週${d.conditions.hoursPerWeek}時間` : '',
      d.conditions.budgetJpy ? `使えるお金: 〜${Math.round(d.conditions.budgetJpy / 10000)}万円` : '',
      d.conditions.strengths.length ? `得意: ${d.conditions.strengths.join('・')}` : '',
      d.conditions.avoid.length ? `やりたくない: ${d.conditions.avoid.join('・')}` : '',
      '',
      '**計画は、この条件で本当に回る形にしてください。**'
      + '使える時間を超える週を作らない。やりたくないことを含む道は引かない。',
    ].filter(Boolean).join('\n');
    const r = await startWork(goal, ctx);
    if (r.ok) {
      await s.adoptCandidate(sessionId, candidateId, r.id);
      /**
       * **どの道で進めるかは、いちばん最初の「決めたこと」。**
       * 選ばなかった2つと並べて台帳に残す — **なぜその道かは、選ばなかった道と
       * 並べてはじめて意味になる**（→ CLAUDE.md 入口）。
       * ここから先の実行の依頼文にも、この決定が載る（Phase 9 の受け渡し）。
       */
      await s.addDecided(r.id, {
        question: 'どの道で進めるか',
        chosen: c.name,
        why: c.summary,
        options: d.candidates.map((x) => ({
          label: x.name,
          description: x.id === candidateId ? x.summary : (x.notChosenWhy || x.summary),
        })),
      }).catch(() => {});
      // **1チャット = 1 Work。** 会話から採用したなら、その会話の Work にする
      if (threadId) await s.linkThread(threadId, { workId: r.id }).catch(() => false);
    }
    return r;
  } catch (e) {
    return { ok: false, need: 'error', message: sayError(e, '候補を採用できませんでした') };
  }
}

/* ══════════════ Case D ══════════════ */


export async function profileGet(id: string): Promise<Profile | null> {
  try { return await store().getProfile(id); } catch { return null; }
}


/** 見つかったこと1件から Work を立てる（診断は必ず「次に何をするか」まで持つ、の実行側） */
export async function findingToWork(
  profileId: string, index: number, threadId?: string, ending?: string,
): Promise<StartResult> {
  try {
    const s = store();
    const p = await s.getProfile(profileId);
    const f = p?.diagnosis?.findings[index];
    if (!p || !f) return { ok: false, need: 'error', message: 'その診断は見つかりませんでした' };
    // もう立てたものは二度立てない（候補の adopted_work_id と同じ守り）
    if (f.workId) return { ok: true, id: f.workId, real: p.diagnosis?.real ?? true };
    const goal = [`${f.work.title}をやりたい`, `終わり: ${ending || f.work.goal}`].join('\n');
    /** 診断の中身は統括AIにだけ渡す（吹き出しは社長が決めたことだけ） */
    const ctx = [
      `いまの事業: ${p.name}`,
      `見つかったこと: ${f.title}（${f.why}）`,
      ...(f.evidence.length ? [`根拠: ${f.evidence.join(' / ')}`] : []),
    ].join('\n');
    const r = await startWork(goal, ctx);
    if (r.ok) {
      await s.linkFinding(profileId, index, r.id);
      if (threadId) await s.linkThread(threadId, { workId: r.id }).catch(() => false);
    }
    return r;
  } catch (e) {
    return { ok: false, need: 'error', message: sayError(e, 'Work を立てられませんでした') };
  }
}
