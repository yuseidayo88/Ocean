'use server';

import { diagnoseRun, discoverStep } from '@/lib/exec/entry';
import type { Conditions, Question } from '@/lib/exec/types';
import { store, type Discovery, type Profile } from '@/lib/store';
import { sayError } from '@/lib/errors';
import { startWork, type StartResult } from './work';

/**
 * 入口（Case B / D）の口。
 * Case B: 条件を集める → 候補3つ → 選んで Work 化（`/discovery`）
 * Case D: 取り込む → 診断 → 見つかったことから Work 化（`/import` → `/diagnosis`）
 */

/* ══════════════ Case B ══════════════ */

export type DiscoverResult =
  | { ok: true; id: string; kind: 'ask'; questions: Question[]; conditions: Conditions; real: boolean }
  | { ok: true; id: string; kind: 'proposed'; real: boolean }
  | { ok: false; message: string };

export async function discoveryStep(
  sessionId: string | null, text: string, force: boolean,
): Promise<DiscoverResult> {
  try {
    const s = store();
    /**
     * **URL の `?s=` を信じない。** 消えた探索（デモはサーバー入れ替えで消える／
     * 他人の id）に書きにいくと、memory は無言 return・supabase は0行更新や FK 違反で、
     * **deep の1往復ぶんを払ってから**入力が消える。無ければ作り直す
     */
    let id = sessionId ?? '';
    let cur = id ? await s.getDiscovery(id) : null;
    if (!cur) { id = await s.createDiscovery(); cur = await s.getDiscovery(id); }
    const before = cur?.conditions ?? { strengths: [], avoid: [] };
    const out = await discoverStep(before, text.trim(), force);

    // 統括AIが写した差分を、いまの条件に重ねる（言っていない項目は前のまま）
    const merged: Conditions = {
      hoursPerWeek: out.conditions.hoursPerWeek ?? before.hoursPerWeek ?? null,
      budgetJpy: out.conditions.budgetJpy ?? before.budgetJpy ?? null,
      strengths: out.conditions.strengths ?? before.strengths,
      avoid: out.conditions.avoid ?? before.avoid,
      deadline: out.conditions.deadline ?? before.deadline ?? null,
    };
    await s.setConditions(id, merged, out.real);

    if (out.candidates.length) {
      await s.setCandidates(id, out.candidates);
      return { ok: true, id, kind: 'proposed', real: out.real };
    }
    return { ok: true, id, kind: 'ask', questions: out.questions, conditions: merged, real: out.real };
  } catch (e) {
    return { ok: false, message: sayError(e, '統括AIが応えませんでした') };
  }
}

export async function discoveryGet(id: string): Promise<Discovery | null> {
  try { return await store().getDiscovery(id); } catch { return null; }
}

/**
 * 候補を採用して Work にする。ゴールは候補＋条件から組む（Case A と同じ道を通る）。
 * **選ばなかった候補は残る**（不変条件 9）。
 */
export async function adoptCandidate(sessionId: string, candidateId: string): Promise<StartResult> {
  try {
    const s = store();
    const d = await s.getDiscovery(sessionId);
    const c = d?.candidates.find((x) => x.id === candidateId);
    if (!d || !c) return { ok: false, need: 'error', message: 'その候補は見つかりませんでした' };
    const goal = [
      `${c.name}を立ち上げたい`,
      `背景: ${c.summary}`,
      d.conditions.hoursPerWeek ? `使える時間: 週${d.conditions.hoursPerWeek}時間` : '',
      d.conditions.budgetJpy ? `使えるお金: 〜${Math.round(d.conditions.budgetJpy / 10000)}万円` : '',
      d.conditions.strengths.length ? `得意: ${d.conditions.strengths.join('・')}` : '',
      d.conditions.avoid.length ? `やりたくない: ${d.conditions.avoid.join('・')}` : '',
    ].filter(Boolean).join('\n');
    const r = await startWork(goal);
    if (r.ok) await s.adoptCandidate(sessionId, candidateId, r.id);
    return r;
  } catch (e) {
    return { ok: false, need: 'error', message: sayError(e, '候補を採用できませんでした') };
  }
}

/* ══════════════ Case D ══════════════ */

/**
 * 取り込む。profileId が null なら作ってから足す。
 * summary（読めた中身）があれば done、無ければ queued — **読めていないものを読めたと言わない**。
 */
export async function importAdd(
  profileId: string | null,
  src: { locator: string; kind: 'site' | 'doc' | 'sheet'; summary?: string },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const locator = src.locator.trim().slice(0, 200);
  if (!locator) return { ok: false, message: '取り込むものを教えてください' };
  try {
    const s = store();
    // `?p=` も信じない（`?s=` と同じ理由）。消えていたら作り直す
    let id = profileId ?? '';
    if (id && !(await s.getProfile(id))) id = '';
    if (!id) id = await s.createProfile('わたしの事業');
    await s.addSource(id, {
      kind: src.kind, locator,
      summary: src.summary?.slice(0, 4000) || undefined,
      status: src.summary ? 'done' : 'queued',
    });
    return { ok: true, id };
  } catch (e) {
    return { ok: false, message: sayError(e, '取り込めませんでした') };
  }
}

export async function profileGet(id: string): Promise<Profile | null> {
  try { return await store().getProfile(id); } catch { return null; }
}

/** 診断する。統括AIが deep の1往復で、数字の帯と見つかったこと（Work つき）まで出す */
export async function runDiagnosis(
  profileId: string,
): Promise<{ ok: true; real: boolean } | { ok: false; message: string }> {
  try {
    const s = store();
    const p = await s.getProfile(profileId);
    if (!p || !p.sources.length) return { ok: false, message: '先に、サイトや資料を1つ取り込んでください' };
    const out = await diagnoseRun(p.sources.map((x) => ({ kind: x.kind, locator: x.locator, summary: x.summary })));
    if (out.name || out.stage) await s.setProfileMeta(profileId, { name: out.name, stage: out.stage });
    await s.saveDiagnosis(profileId, { facts: out.facts, findings: out.findings, real: out.real });
    return { ok: true, real: out.real };
  } catch (e) {
    return { ok: false, message: sayError(e, '診断できませんでした') };
  }
}

/** 見つかったこと1件から Work を立てる（診断は必ず「次に何をするか」まで持つ、の実行側） */
export async function findingToWork(profileId: string, index: number): Promise<StartResult> {
  try {
    const s = store();
    const p = await s.getProfile(profileId);
    const f = p?.diagnosis?.findings[index];
    if (!p || !f) return { ok: false, need: 'error', message: 'その診断は見つかりませんでした' };
    // もう立てたものは二度立てない（候補の adopted_work_id と同じ守り）
    if (f.workId) return { ok: true, id: f.workId, real: p.diagnosis?.real ?? true };
    const goal = [
      `${f.work.title}をやりたい`,
      `終わり: ${f.work.goal}`,
      `背景: ${p.name} の診断で「${f.title}」（${f.why}）`,
      ...(f.evidence.length ? [`根拠: ${f.evidence.join(' / ')}`] : []),
    ].join('\n');
    const r = await startWork(goal);
    if (r.ok) await s.linkFinding(profileId, index, r.id);
    return r;
  } catch (e) {
    return { ok: false, need: 'error', message: sayError(e, 'Work を立てられませんでした') };
  }
}
