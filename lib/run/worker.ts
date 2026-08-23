import { hasKey, providerFor, costUsd, type ModelProvider, type Msg } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';
import { personaOf } from '@/lib/roster';
import { store, type LiveWork } from '@/lib/store';
import { RUN_TOOLS } from './tools';

/**
 * AI社員が1タスクを最後まで走る（Phase 7）。
 *
 *   タスクを取る → 社員の定義を頭に載せる → 道具4つで1往復 →
 *   歩み（run_steps）・成果物・状態を書いて閉じる
 *
 * **1タスク=1往復。** ループを回さないのは手抜きではなく安全弁 —
 * 途中の道具はぜんぶ「書き残す」系なので、往復する理由がない。
 * Web調査のような「読む」道具が入るとき（Phase 8+）に初めてループが要る。
 *
 * 進捗はここでは書かない。addStep の progress が DB の引き金で導出される。
 */

const say = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type RunOutcome =
  | { ok: true; deliverable?: string }
  /** 社長の判断で止まった（失敗ではない） */
  | { ok: 'decision'; question: string }
  | { ok: false; error: string };

function pick(): ModelProvider {
  return hasKey() ? providerFor('standard') : new FakeProvider();
}

export async function runTask(work: LiveWork, taskId: string): Promise<RunOutcome> {
  const s = store();
  const task = work.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: 'タスクが見つかりません' };
  const phase = work.phases.find((p) => p.id === task.phaseId);

  const runId = await s.startRun(taskId);
  let seq = 0;
  const usage = { in: 0, out: 0 };
  let wrote: string | undefined;
  let bodyText = '';
  let decision: { question: string; why: string; options: unknown[] } | undefined;
  let finished = false;

  try {
    /**
     * 文脈: 定義（誰か）→ 会社の状況（何のためか）→ タスク（何をするか）。
     * **同じフェーズの済んだ成果物を渡す** — 受け渡しの最小形（本格化は Phase 9）。
     */
    const prior = (work.dels ?? [])
      .filter((d) => work.tasks.some((t) => t.id === d.taskId && t.phaseId === task.phaseId && t.state === 'done'))
      .slice(0, 3);

    const system = [
      personaOf(task.ownerSlug ?? '', task.owner ?? 'AI社員'),
      '',
      '道具の使い方:',
      '1. log_step で作業の区切りを3〜6回記録する（progress は正直に）',
      '2. write_deliverable で成果物を1つ書く',
      '3. 事業の判断（価格・対象など）に当たったら ask_decision で止まる',
      '4. 最後に finish。**文章では答えない** — すべて道具で',
    ].join('\n');

    const messages: Msg[] = [{
      role: 'user',
      content: [
        `会社のゴール: ${work.goal}`,
        `いまのフェーズ: ${phase?.name ?? ''} — ${phase?.goal ?? ''}`,
        ...(prior.length
          ? ['', 'ここまでの成果物（参考にする）:',
             ...prior.map((d) => `--- ${d.title} ---\n${(d.body ?? d.preview ?? '').slice(0, 3000)}`)]
          : []),
        '',
        `あなたのタスク: ${task.title}`,
        `やること: ${task.intent || task.title}`,
        '',
        '道具を順に使って、このタスクを最後までやってください。',
      ].join('\n'),
    }];

    for await (const c of pick().stream({
      tier: 'standard', system, messages, tools: RUN_TOOLS, maxTokens: 8000, effort: 'low',
    })) {
      if (c.type === 'tool_use') {
        const a = (c.input ?? {}) as Record<string, unknown>;
        if (c.name === 'log_step') {
          await s.addStep(runId, {
            seq: ++seq, kind: 'tool_use', tool: 'log_step',
            summary: String(a.title ?? ''), progress: clamp(a.progress),
          });
        } else if (c.name === 'write_deliverable') {
          wrote = String(a.title ?? task.title);
          bodyText = String(a.body ?? '');
          await s.addDeliverable({
            workId: work.id, taskId, employeeId: task.ownerId,
            title: wrote, kind: String(a.kind ?? 'doc'), body: String(a.body ?? ''),
          });
          await s.addStep(runId, {
            seq: ++seq, kind: 'tool_use', tool: 'write_deliverable', summary: `${wrote} を書いた`,
          });
        } else if (c.name === 'ask_decision') {
          decision = {
            question: String(a.question ?? '判断してください'),
            why: String(a.why ?? ''),
            options: Array.isArray(a.options) ? a.options : [],
          };
        } else if (c.name === 'finish') {
          finished = true;
          await s.addStep(runId, {
            seq: ++seq, kind: 'message', summary: String(a.summary ?? '完了'), progress: 100,
          });
        }
      } else if (c.type === 'done') {
        usage.in += c.usage.inputTokens;
        usage.out += c.usage.outputTokens;
      }
    }

    const costCents = Math.round(costUsd('standard', usage.in, usage.out) * 100);

    if (decision) {
      // 判断で止まる。失敗ではないので run は done、タスクは needs_decision
      await s.finishRun(runId, { status: 'done', tokensIn: usage.in, tokensOut: usage.out, costCents });
      await s.markDecision(taskId, decision);
      return { ok: 'decision', question: decision.question };
    }

    if (!wrote && !finished) {
      // 道具を1つも使わなかった＝弱いモデルが文章で答えた等。正直に失敗
      await s.finishRun(runId, {
        status: 'failed', tokensIn: usage.in, tokensOut: usage.out, costCents,
        error: '成果物が書かれませんでした',
      });
      await s.addNotification({
        kind: 'エラー', body: `${task.title} — 成果物が書かれないまま終わりました`,
        subjectType: 'task', subjectId: taskId,
      });
      return { ok: false, error: '成果物が書かれませんでした' };
    }

    await s.finishRun(runId, { status: 'done', tokensIn: usage.in, tokensOut: usage.out, costCents });
    if (wrote) {
      /**
       * **統括AIのレビュー**（Phase 8）。成果物を fast の目で1度見て、
       * 社長への通知に一言添える。鍵が無い環境では黙って飛ばす（偽のレビューを作らない）。
       */
      const note = await execGlance(wrote, bodyText).catch(() => '');
      await s.addNotification({
        kind: '要確認',
        body: `${wrote} ができました — ${task.owner ?? 'AI社員'}${note ? `。統括AI: ${note}` : ''}`,
        subjectType: 'task', subjectId: taskId,
      });
    }
    return { ok: true, deliverable: wrote };
  } catch (e) {
    await s.finishRun(runId, {
      status: 'failed', tokensIn: usage.in, tokensOut: usage.out, costCents: 0, error: say(e),
    }).catch(() => {});
    await s.addNotification({
      kind: 'エラー', body: `${task.title} — 途中で止まりました`, subjectType: 'task', subjectId: taskId,
    }).catch(() => {});
    return { ok: false, error: say(e) };
  }
}

/**
 * 統括AIがひと目見る。**判定ではなく一言** — 「どこを見ればいいか」を社長に添える。
 * 深く読むレビュー（差し戻しの提案など）は品質担当の仕事（Phase 10）。
 */
async function execGlance(title: string, body: string): Promise<string> {
  if (!hasKey()) return '';
  let out = '';
  for await (const c of providerFor('fast').stream({
    tier: 'fast', effort: 'low', maxTokens: 300,
    system: 'あなたは一人社長の統括AI。部下の成果物を渡すとき、社長がどこを見ればいいかを日本語40文字以内の1文で添える。文だけ返す。',
    messages: [{ role: 'user', content: `成果物「${title}」:
${body.slice(0, 4000)}` }],
  })) {
    if (c.type === 'text') out += c.text;
  }
  return out.trim().slice(0, 60);
}

const clamp = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : undefined;
};
