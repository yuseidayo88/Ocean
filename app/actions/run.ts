'use server';

import { runTask, type RunOutcome } from '@/lib/run/worker';
import { store, type LiveDecision, type LiveDeliverable, type LiveEmployee, type RunStep } from '@/lib/store';
import { slugOf } from '@/lib/roster';
import { AppError } from '@/lib/errors';
import { draftNextTasks } from '@/lib/exec/next';
import { askGate } from '@/lib/exec/gate';
import { sayError } from '@/lib/errors';
import { capCents, dayKey, dayStart } from '@/lib/run/budget';

/**
 * ポンプ（Phase 7 → 2026-08-25 に会社ぜんぶへ広げた）。**次のタスクを1つ起こす。**
 *
 * Durable Object もキューも無い環境（Vercel / ローカル）でも死なない形 —
 * running が居なければ次の queued を1つ走らせ、終わるまで返らない。
 *
 * **前は Work 画面だけが呼んでいた**（「見ていないところで料金だけ増える、が起きない」）。
 * それは会社としては弱すぎた — ホームやチャットを開いているあいだ、動いている Work は
 * 止まったままだった。いまは**器（Shell）がどの画面からでも会社ぜんぶを進める**。
 * 見ていないあいだの使いすぎは、止めるのではなく**1日の上限**で受ける（→ `lib/run/budget.ts`）。
 */
export type PumpResult =
  | { ran: false; why?: 'cap' | 'balance' | 'idle' }
  | { ran: true; taskId: string; outcome: RunOutcome };

/**
 * 走らせていいか。**残高**（もう無い）と**きょうのぶん**（ここまで）の2本。
 * 当たり方が違う — 残高は Work ごと paused、きょうのぶんは止まるだけであすまた動く。
 */
async function allowed(s: ReturnType<typeof store>, workId: string): Promise<null | 'cap' | 'balance'> {
  const balance = await s.balanceCents().catch(() => null);
  if (balance !== null && balance <= 0) {
    await s.pauseWork(workId, '枠に当たって止まりました。プランを見てください');
    return 'balance';
  }
  const cap = capCents();
  if (cap > 0) {
    const spent = await s.spentSinceCents(dayStart()).catch(() => null);
    if (spent !== null && spent >= cap) {
      // **1日1通だけ。** ポンプは数秒ごとに来るので、ここが通知を積む口になってはいけない
      await s.noticeOnce(dayKey(), 'エラー',
        'きょうのぶんの上限に達しました。あすまた動きます（上限は請求とプランで見られます）')
        .catch(() => {});
      return 'cap';
    }
  }
  return null;
}

/**
 * **フェーズの関所。** タスクが出そろったフェーズを畳み、待つものが無ければ次を引く。
 *
 * 待つものは2つ（→ `lib/store/types.ts` の `PhaseGate`）——
 * 計画の **◆**（社長でないと決められないところ）と、**まだ見ていない成果物**。
 *
 * 成果物のほうは 2026-08-25 に足した。社長の言葉で言うと
 * 「完全自動で動くというよりかは、**成果物ができたら確認してもらって、
 * それで進めていいのか確認してもらう**」——
 * つまり**承認そのものが「進んでいい」の合図**で、押されるまで次のフェーズは始まらない。
 * 見せる前に次へ進んでしまえば、直したいところがあっても後戻りになる。
 *
 * ◆ も未確認の成果物も無いフェーズは、これまでどおり会社が自分で進む。
 */
async function gate(s: ReturnType<typeof store>, workId: string): Promise<void> {
  /**
   * **◆ は、まだ決めていないものだけが関門**（2026-08-26）。
   *
   * 前は `planGates` が返すフェーズ名を、決めたあとも関門として渡し続けていた —
   * というより、**そもそも社長は一度も聞かれなかった**（質問が捨てられていた）。
   * いまは「答えていない ◆」だけを渡すので、**答えた瞬間に関門が外れて**、
   * 次のポンプが次のフェーズを引く。
   */
  const all = await s.planGates(workId).catch(() => []);
  const decs = await s.listDecisions(workId).catch(() => []);
  const answered = new Set(decs.filter((d) => d.status === 'decided').map((d) => d.question));
  const opened = new Set(decs.filter((d) => d.status === 'open').map((d) => d.question));
  const left = all.filter((g) => !answered.has(g.question));

  const shut = await s.closePhaseIfDone(workId, left.map((g) => g.afterPhase))
    .catch(() => ({ closed: [], hold: false, ready: false, at: null }));

  /**
   * **止まっているのが ◆ なら、その問いを社長に出す。**
   * 計画に書いた質問をそのまま使い、選択肢だけをそのフェーズの成果物から作る。
   * （`hold` のときだけ。成果物がまだ 要確認 なら、先にそちらを見てもらう）
   */
  if (shut.hold && shut.at) {
    const g = left.find((x) => x.afterPhase === shut.at);
    if (g && !opened.has(g.question)) {
      /**
       * **閉じたらすぐ出す。**「成果物を見てから」にはしない —
       * ◆ は Work の画面の帯に出て、**成果物はそのすぐ下に並んでいる**ので、
       * 見てから決めることはできる。待たせると、社長が「次のフェーズへ進める」を
       * 押した瞬間に ◆ が素通りして、**計画で約束した問いが一度も出ない**
       * （実際そうなっていた）。
       */
      const work = await s.getWork(workId).catch(() => null);
      if (work) await askGate(work, g.afterPhase, g.question).catch(() => false);
    }
  }
  if (!shut.ready) return;

  /**
   * **引けなかったところを、何度も引き直さない。** ポンプは数秒ごとに来るので、
   * 失敗するたびに引き直すと deep の1往復を延々と払うことになる。
   * 「引けませんでした」の1通がそのまま**もう試した印**になる（立てずに読む）。
   */
  const key = `adv-${workId}-${shut.at ?? ''}`;
  if (await s.noticed(key).catch(() => false)) return;

  const r = await approvePhase(workId).catch(() => ({ ok: false as const, message: '' }));
  /**
   * **「次に進みます」と言ったのに進めなかった、を黙らない。**
   * 引けなければフェーズは review のまま残るので、Work 画面の帯から社長が押せる。
   * ただし、それを社長が知らないままだと会社が止まったように見える。
   */
  if (!r.ok) {
    await s.noticeOnce(key, 'エラー',
      `フェーズ「${shut.at}」のあと、次のフェーズを引けませんでした。Work から進めてください`)
      .catch(() => {});
  }
}

export async function pumpWork(workId: string): Promise<PumpResult> {
  try {
    const s = store();
    // 止まったままの実行があれば先に回収する（無ければ何もしない）。
    // これが無いと、サーバーが途中で入れ替わったとき running が残り、ポンプが永久に譲り続ける
    await s.reclaimStalled(workId).catch(() => {});
    const work = await s.getWork(workId);
    if (!work || work.status !== 'active') return { ran: false, why: 'idle' };
    const next = await s.nextQueued(workId);
    /**
     * **起こすタスクが無くても、関所は毎回見る。**
     * 社長が最後の成果物を承認した瞬間が「進んでいい」の合図なので、
     * ここで見ないと、承認したのに次のフェーズが始まらない。
     */
    if (!next.length) { await gate(s, workId); return { ran: false, why: 'idle' }; }

    const stop = await allowed(s, workId);
    if (stop) return { ran: false, why: stop };

    /**
     * **起こせる人は全員起こす**（2026-08-26。社長の「他のAIが全員動き出す」）。
     *
     * 前は1件ずつだったので、4人採用しても動くのは常に1人だった。
     * 取り合いは `startRun` の atomic な置き換えが捌く — 2つのポンプが
     * 同じタスクを拾っても、走るのは片方だけ（もう片方は conflict）。
     *
     * **`allSettled` にする。** 1本の失敗でほかの結果まで捨てない。
     * 1日の上限はこの束の前に1度だけ測るので、**1ティックぶんは超えうる** —
     * 上限は「その日はここまで」の線であって、1トークン単位の栓ではない。
     */
    const done = await Promise.allSettled(next.map((t) => runTask(work, t.taskId)));
    await gate(s, workId);
    const first = done.find((r) => r.status === 'fulfilled');
    return {
      ran: true, taskId: next[0].taskId,
      outcome: first?.status === 'fulfilled'
        ? first.value
        : { ok: false, error: '実行が止まりました' },
    };
  } catch (e) {
    // 取り合いに負けただけなら何も起きていない（もう一方のポンプが走らせている）
    if (e instanceof AppError && e.kind === 'conflict') return { ran: false, why: 'idle' };
    return { ran: true, taskId: '', outcome: { ok: false, error: sayError(e, '実行が止まりました') } };
  }
}

/**
 * **会社ぜんぶを1つ進める。** 器（Shell）がどの画面からでも呼ぶ。
 *
 * 動いている Work を古い順に見て、**起こせる人を全員**起こす（2026-08-26）。
 * Work は古い順に1つずつ見る — 1つの Work の中は並列だが、
 * **Work をまたいで一度に走らせはしない**（上限に当たる場所を散らさない）。
 */
export async function pumpCompany(): Promise<PumpResult> {
  try {
    const s = store();
    const ids = await s.activeWorks();
    if (!ids.length) return { ran: false, why: 'idle' };
    // 上限は会社に1つなので、Work を回り始める前に1度だけ測る
    const stop = await allowed(s, ids[0]);
    if (stop) return { ran: false, why: stop };
    for (const id of ids) {
      const r = await pumpWork(id);
      if (r.ran || r.why !== 'idle') return r;
    }
    return { ran: false, why: 'idle' };
  } catch (e) {
    if (e instanceof AppError && e.kind === 'conflict') return { ran: false, why: 'idle' };
    return { ran: true, taskId: '', outcome: { ok: false, error: sayError(e, '実行が止まりました') } };
  }
}

/**
 * **社長が自分で止める / 再開する。**
 * 見ていないあいだも動く会社（1時間ごとの Cron）に、止める手が要る。
 * 止めた Work はポンプが拾わない（`activeWorks` は active だけ）。
 */
export async function holdWork(workId: string, paused: boolean): Promise<{ ok: boolean; message?: string }> {
  try {
    const moved = await store().setWorkPaused(workId, paused);
    return moved ? { ok: true } : { ok: false, message: 'この Work はもうその状態です' };
  } catch (e) {
    return { ok: false, message: sayError(e, paused ? '止められませんでした' : '再開できませんでした') };
  }
}

/** タスクの歩み。右ペインが読む */
export async function taskSteps(taskId: string): Promise<RunStep[]> {
  return store().getSteps(taskId);
}

/**
 * **止まったタスクから戻る**（2026-08-26 → `lib/store/types.ts`）。
 *
 * blocked が1つ残るとフェーズは永久に閉じず、Work は二度と進まない。
 * モデルは失敗する — **失敗そのものは直せないが、失敗から戻れないのは直せる。**
 *
 * どちらも押したあと `wakePump()`（呼ぶ側）で会社を起こす。
 * 待つ理由が無い操作で、次のポンプ（静かなときは15秒）まで待たせない。
 */
export async function retryTask(taskId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const ok = await store().retryTask(taskId);
    return ok ? { ok: true } : { ok: false, message: 'このタスクはもう止まっていません' };
  } catch (e) {
    return { ok: false, message: sayError(e, 'やり直せませんでした') };
  }
}

export async function skipTask(taskId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const ok = await store().skipTask(taskId);
    return ok ? { ok: true } : { ok: false, message: 'このタスクはもう止まっていません' };
  } catch (e) {
    return { ok: false, message: sayError(e, '飛ばせませんでした') };
  }
}

/** 止まった理由（最後の実行の error）。**無ければ空**（でっち上げない） */
export async function taskWhy(taskId: string): Promise<string> {
  try { return await store().taskWhy(taskId); } catch { return ''; }
}

/**
 * **通知の画面から出ずに終わらせる**（2026-08-26）。
 *
 * 通知の画面は「開いて、済ませて、次へ」と自分で書いているのに、
 * **行動は「開く」（＝別の画面へ飛ぶ）と「済みにする」（＝既読にするだけ）の2つ**しかなかった。
 * 判断も承認も差し戻しも、どれも別の画面へ行かないと終わらない。
 * 社長の仕事は4つで、うち2つ（判断する・成果物を見る）がこの画面に集まってくるのに、である。
 *
 * だから通知が指しているタスクから、**いま社長にできること**を引く。
 * **順番は「あなたの番」の強い順** — 判断 ＞ 成果物 ＞ 止まっている。
 * どれでもなければ `null`（**行動をでっち上げない**。「開く」だけが残る）。
 */
export type InboxAct =
  | { kind: 'decision'; taskId: string; workId: string }
  /** フェーズの ◆（タスクに紐づかない。Work のもの） */
  | { kind: 'gate'; workId: string; dec: LiveDecision }
  | { kind: 'deliverable'; delId: string; workId: string; taskId: string;
      title: string; state: string; body: string; delKind: string }
  | { kind: 'stuck'; taskId: string }
  | null;

export async function inboxAct(subjectType?: string, subjectId?: string): Promise<InboxAct> {
  /**
   * **フェーズの ◆ も、この画面で決められる**（2026-08-26）。
   * 通知の画面は「開いて、済ませて、次へ」と自分で書いているので、
   * 判断だけ別の画面へ飛ばさない（→ `DecisionPick` を Work 画面と共有する）。
   */
  if (subjectType === 'work' && subjectId) {
    try {
      const dec = (await store().listDecisions(subjectId))
        .find((d) => d.status === 'open' && !d.taskId);
      return dec ? { kind: 'gate', workId: subjectId, dec } : null;
    } catch { return null; }
  }
  if (subjectType !== 'task' || !subjectId) return null;
  try {
    for (const w of await store().listWorks()) {
      const t = w.tasks.find((x) => x.id === subjectId);
      if (!t) continue;
      if (t.state === 'needs_decision') return { kind: 'decision', taskId: t.id, workId: w.id };
      const d = (w.dels ?? []).find((x) => x.taskId === t.id && x.state === '要確認');
      if (d) {
        return {
          kind: 'deliverable', delId: d.id, workId: w.id, taskId: t.id,
          title: d.title, state: d.state, body: d.body ?? d.preview ?? '', delKind: d.kind,
        };
      }
      if (t.state === 'blocked' || t.state === 'failed') return { kind: 'stuck', taskId: t.id };
      return null;                              // その通知の用は、もう済んでいる
    }
    return null;
  } catch { return null; }
}


/* ══════════════ レビューと承認（Phase 8）══════════════ */

/** 会社の成果物ぜんぶ（新しい順）。成果物画面が読む */
export async function listDels(): Promise<(LiveDeliverable & { workId: string; workTitle: string })[]> {
  try { return await store().listDels(); } catch { return []; }
}

/** 承認する。状態が 承認済 になるだけ — 大げさなことは起きない（二度押しは何もしない） */
export async function approveDel(delId: string): Promise<void> {
  await store().setDelStatus(delId, 'approved');
}

/**
 * 差し戻す。**直しは言葉で** — 書いた指摘がそのまま直しタスクになり、
 * 同じ担当に積まれて、ポンプが走らせる。
 */
export async function sendBackDel(
  delId: string, workId: string, src: { taskId?: string; title: string }, note: string,
): Promise<{ ok: boolean; message?: string }> {
  const text = note.trim();
  if (!text) return { ok: false, message: '直したいところを書いてください' };
  try {
    // 差し戻せた1回だけが直しタスクを積む（二度押し・同時押しで2つ積まれない）
    const s = store();
    const flipped = await s.setDelStatus(delId, 'rejected');
    if (!flipped) return { ok: false, message: 'この成果物はもう片づいています' };
    await s.addFixTask(workId, src, text);
    /**
     * 指摘は担当の**学び**にも残す（Agent Memory）。直しタスクは1回で消えるが、
     * 「社長がどこを直させたか」は次の仕事でも効く。失敗しても差し戻しは倒さない。
     */
    if (src.taskId) {
      const work = await s.getWork(workId).catch(() => null);
      const ownerId = work?.tasks.find((t) => t.id === src.taskId)?.ownerId;
      // 指摘は複数行で書かれる。**1行に潰してから**残す（学びは1件=1行。改行のまま足すと行数だけ増える）
      const gist = text.replace(/\s+/g, ' ').trim();
      const line = gist.length > 60 ? `${gist.slice(0, 60)}…` : gist;
      if (ownerId) await s.addLearnings(ownerId, [`社長からの差し戻し（${src.title}）: ${line}`]).catch(() => {});
    }
    // **社長のことにも残す。** 差し戻しは、この社長が何を良しとしないかの手がかり
    {
      const gist = text.replace(/\s+/g, ' ').trim();
      await s.addFounderNotes([`差し戻したときに言ったこと: ${gist.slice(0, 60)}`]).catch(() => {});
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: sayError(e, '差し戻せませんでした') };
  }
}

/* ══════════════ 判断と受け渡し（Phase 9）══════════════ */

/** そのタスクで開いている判断（右ペインが読む） */
export async function taskDecision(taskId: string): Promise<LiveDecision | null> {
  try { return await store().getDecision(taskId); } catch { return null; }
}

/**
 * 社長が決める。decisions → decided、タスクは queued に戻り、
 * **次の実行は決めたことを文脈に持って**走り直す（ポンプが拾う）。
 */
export async function decide(decisionId: string, chosen: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const s = store();
    await s.answerDecision(decisionId, chosen);
    /**
     * **会社が社長を覚える**（2026-08-26。Hermes Agent の user modeling に当たる）。
     * 選んだという**事実**をそのまま1行にする — モデルは呼ばない。
     * 次の計画と次の実行に載るので、同じことを二度聞かれなくなる。
     */
    const d = (await s.listDecisions().catch(() => [])).find((x) => x.id === decisionId);
    if (d) await s.addFounderNotes([`「${d.question}」では「${chosen}」を選んだ`]).catch(() => {});
    return { ok: true };
  } catch (e) {
    return { ok: false, message: sayError(e, '決められませんでした') };
  }
}

/** 会社の決めたこと（決定事項画面が読む） */
export async function listDecisions(): Promise<LiveDecision[]> {
  try { return await store().listDecisions(); } catch { return []; }
}

/**
 * **review のフェーズを承認して、次のフェーズへ。**
 * 統括AIが前のフェーズの成果物と決定を見て、次のタスクを引いてから進める。
 */
export async function approvePhase(workId: string): Promise<{ ok: boolean; next?: string | null; message?: string }> {
  try {
    const s = store();
    const work = await s.getWork(workId);
    if (!work) return { ok: false, message: 'Work が見つかりません' };
    const review = work.phases.find((p) => p.state === 'review');
    if (!review) return { ok: false, message: '承認を待っているフェーズがありません' };

    const after = work.phases.find((p) => p.seq === review.seq + 1);
    const tasks = after
      ? await draftNextTasks(work, { name: after.name, goal: after.goal },
          (await s.listDecisions(workId)).filter((d) => d.status === 'decided'))
      : [];
    const next = await s.advancePhase(workId, tasks);
    return { ok: true, next };
  } catch (e) {
    return { ok: false, message: sayError(e, '進められませんでした') };
  }
}

/* ══════════════ 社員（Phase 10）══════════════ */

/**
 * 採用する。**候補の id ではなくロスターの定義で採る**（→ lib/roster）。
 * 同じ定義の社員がいれば使い回す — 調査担当が2人にならない。
 */
export async function hire(definitionId: string, displayName: string): Promise<{ ok: boolean; message?: string }> {
  try {
    // **別名はロスターの slug に寄せてから採る**（在籍と候補の突き合わせが1つの語で済む）
    await store().hireEmployee(slugOf(definitionId), displayName);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: sayError(e, '採用できませんでした') };
  }
}

/** 在籍の一覧（メンバー画面が読む） */
export async function listEmployees(): Promise<LiveEmployee[]> {
  try { return await store().listEmployees(); } catch { return []; }
}

/* ══════════════ 課金の骨格（Phase 11）══════════════ */

/** 請求・プラン画面が読む。**トークンの数字を出していいのはこの画面だけ** */
export async function billing(): Promise<{
  balanceTokens: number | null;
  /** きょう使ったぶん / 1日の上限。**null = 数えていない**（デモ） */
  todayTokens: number | null;
  capTokens: number | null;
  /**
   * **閉じているあいだも会社が進むか**（2026-08-26）。
   *
   * この製品の売りは「見ていなくても会社が進む」で、それを本当にしているのは
   * 1時間ごとの Cron（`/api/cron`）。鍵が3つそろっていないと **503 で何もしない** —
   * つまり**開いているあいだしか進まない**。それが画面のどこにも出ていなかった。
   *
   * 1日の上限のすぐ隣に置く。どちらも「目を離しているあいだ、何が起きるか」の話で、
   * 上限だけ出して「進むかどうか」を出さないのは、片側だけ言っていることになる。
   * **鍵の中身は返さない**（`/api/health` と同じ作法）。
   */
  awake: boolean;
  rows: { deltaTokens: number; reason: string; when?: string; workTitle?: string }[];
}> {
  const awake = Boolean(process.env.CRON_SECRET && process.env.RUNNER_EMAIL && process.env.RUNNER_PASSWORD);
  try {
    const s = store();
    const [cents, rows, today] = await Promise.all([
      s.balanceCents(), s.ledger(), s.spentSinceCents(dayStart()).catch(() => null),
    ]);
    // 1トークン = $0.00001 → 1セント = 1,000トークン（→ docs/design/05）
    const cap = capCents();
    return {
      // **セントは端数を持つ**（0034）。トークンに直すのは表示のときだけなので、
      // ここで丸める（0.057 セント → 57 トークン）
      balanceTokens: cents === null ? null : Math.round(cents * 1000),
      todayTokens: today === null ? null : Math.round(today * 1000),
      capTokens: cap > 0 ? Math.round(cap * 1000) : null,
      awake,
      rows: rows.map((r) => ({
        deltaTokens: Math.round(r.deltaCents * 1000), reason: r.reason, when: r.when, workTitle: r.workTitle,
      })),
    };
  } catch {
    return { balanceTokens: null, todayTokens: null, capTokens: null, awake, rows: [] };
  }
}
/* ══════════════ 朝の報告 ══════════════ */

/**
 * その日はじめて開いたとき、統括AIが**聞かれる前に**きのうの動きを1通にする。
 * 器（Shell）が開いたときに1回だけ呼ぶ。重複はストア側が日付で止める。
 * 失敗しても画面は困らない（報告は義務ではない）ので、黙って false。
 */
export async function morning(day: string): Promise<boolean> {
  try { return await store().morningBrief(day); } catch { return false; }
}
