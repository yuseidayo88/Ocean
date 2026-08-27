import { hasKey, providerFor, billedCostUsd, modelFor, type ModelProvider, type Msg } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';
import { execPref, staffPref } from '@/lib/exec/pref';
import { personaOf } from '@/lib/roster';
import { store, type LiveWork } from '@/lib/store';
import { reviewSkills } from '@/lib/exec/skills';
import { reviewDeliverable } from '@/lib/exec/qa';
import { webOn } from '@/lib/ai/web';
import { recallBlock, termsOf } from '@/lib/exec/recall';
import { founderBlock, tendMemory } from '@/lib/exec/memory';
import { RUN_TOOLS, drawWorkflow, makeImage, writeDeliverable } from './tools';
import { draw, imageModel, imagesOn } from '@/lib/ai/image';
import { imageCostUsd } from '@/lib/ai/catalog';
import type { ToolDef } from '@/lib/ai/provider';
import { checkWorkflow, fatalOf, packDoc, toWorkflow } from '@/lib/diagram/parse';
import { readyTools, runTool, toolsLine } from '@/lib/mcp/company';
import { MCP_ROUNDS, TOOL_PREFIX } from '@/lib/mcp/types';
import { sayDiags, type Diag } from '@/lib/diagram/check';
import type { Workflow } from '@/lib/diagram/types';

/**
 * AI社員が1タスクを最後まで走る（Phase 7）。
 *
 *   タスクを取る → 社員の定義を頭に載せる → 道具4つで1往復 →
 *   歩み（run_steps）・成果物・状態を書いて閉じる
 *
 * **1タスク=1往復。** ループを回さないのは手抜きではなく安全弁 —
 * 途中の道具はぜんぶ「書き残す」系なので、往復する理由がない。
 *
 * **例外は、会社が MCP をつないでいるとき**（Phase 12。2026-08-25）。
 * あれは「読む」道具なので、読んだ結果を見てから書くことになる。
 * つないでいない会社ではこれまでどおり1往復 — **払う理由が無いのに往復しない**。
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

  /**
   * **決めたことは必ず依頼文に入る**（Phase 9 の完了条件）。
   * 読んだ記録は decision_refs に残す — 「渡したはず」を作らない。
   */
  const decided = (await s.listDecisions(work.id).catch(() => []))
    .filter((d) => d.status === 'decided' && d.chosen);

  /**
   * スキル＝**必要なときだけ読む手順書。** 1タスク=1往復なので「途中で取りに行く」は
   * できない — このタスクに関わりそうなものだけ載せる（載せたら used_count を進める＝読んだ印）。
   *
   * **選び方を作り直した**（2026-08-26）。前は**名前の字の重なり**で数えていたので、
   * 「の」「を」「方」が当たるだけで上位に来た。しかも
   * **`desc`（いつ読むか）を一度も見ていなかった** — 道具の説明には
   * 「ここが合っていないと誰も読めない」と書いてあるのに、書かせたきり誰も読んでいなかった。
   *
   * **社員が手順書を書けるようになった以上、ここは効く**（棚が増えるほど、
   * 当てずっぽうで2枚選ぶのは悪くなる）。思い出すのと同じ言葉の拾い方に揃えた。
   * **1枚も当たらなければ、載せない** — 関係ない手順書は、読ませるだけ無駄で、高い。
   */
  const allSkills = (await s.listSkills().catch(() => []))
    /**
     * **通ったものだけ**（2026-08-26）。社員が書いたばかりのものは draft なので読まれない。
     * **その社員に付いているスキルも読む** — 前は会社ぜんぶのものだけ見ていたので、
     * 設定ペインで社員に付けたスキルが**実行から一度も読まれていなかった**。
     */
    .filter((x) => x.on && x.status === 'active' && x.source !== 'learned' && x.body
      && (x.scope === 'company' || (!!task.ownerId && x.employeeId === task.ownerId)));
  // **フェーズも手がかりに入れる。** 「調査のまとめ方」は、タスク名ではなくフェーズが言っている
  const hint = `${task.title} ${task.intent} ${phase?.name ?? ''} ${phase?.goal ?? ''}`;
  const skills = allSkills
    .map((x) => ({ x, hit: termsOf(`${x.name} ${x.desc ?? ''}`, 12).filter((t) => hint.includes(t)).length }))
    .filter((v) => v.hit > 0)
    .sort((a, b) => b.hit - a.hit)
    .slice(0, 3)
    .map((v) => v.x);

  /** 学び＝この社員が仕事から書き溜めたメモ。最新10行だけ載せる */
  const lessons = task.ownerId
    ? (await s.learnings(task.ownerId).catch(() => [])).slice(-10)
    : [];
  /**
   * **社長が「毎回効かせたい」と決めたこと**（2026-08-26。学びからの昇格）。
   * 学びは30行の上限で回って薄まるが、ルールは**残って、毎回効く** —
   * だから頭（system）に、定義の Critical Rules のあとに並べる。
   */
  const myRules = task.ownerId ? await s.rules(task.ownerId).catch(() => []) : [];

  /**
   * 会社の記憶。**承認された成果物の索引**（全 Work・最新5件）を渡す —
   * 別の Work で決まったこと・作られたものを、二度調べ直さないため。
   * 本文は渡さない（読むべきものはタイトルで分かる。トークンを太らせない）。
   */
  const memory = (await s.listDels().catch(() => []))
    .filter((x) => x.state === '承認済').slice(0, 5);

  /**
   * **思い出す**（Hermes の cross-session recall。2026-08-26 → `lib/exec/recall.ts`）。
   *
   * 索引はタイトルしか渡さないので、**別の Work で調べた中身はどこからも届いていなかった**。
   * タスクの題とねらいを問いにして、成果物・決めたこと・会話から関わりのあるものを引く。
   * **往復は増やさない** — 読む道具として渡すのではなく、こちらが先に引いて載せる。
   */
  const memos = (await s.recall(termsOf(`${task.title} ${task.intent}`), 2).catch(() => []))
    // この Work のぶんは `prior` で丸ごと渡しているので、二度載せない
    .filter((m) => !(work.dels ?? []).some((d) => d.title === m.title));

  /** **社長のこと**（会社が覚えていること。同じことを二度聞かない） */
  const founder = await s.founderNotes().catch(() => []);

  /**
   * **この社員の設定で走る**（メンバー画面で社長が選んだモデルと深さ）。
   * 選んでいなければ既定。担当のいないタスクは統括AIの設定を借りない。
   */
  const pref = await staffPref(task.ownerId);
  /** どのモデルで走ったか（ガバナンスの記録。鍵の無い環境は fake） */
  const usedModel = hasKey() ? modelFor('standard', pref.model) : 'fake';

  const runId = await s.startRun(taskId);
  await s.addDecisionRefs(runId, decided.map((d) => d.id)).catch(() => {});
  let seq = 0;
  const usage = { in: 0, out: 0 };
  /** 絵のぶんのトークン。**文字と混ぜない** — 単価が25倍ちがう（→ `imageCostUsd`） */
  const picUse = { in: 0, out: 0, model: '' };
  /**
   * **記帳は1か所で組む**（2026-08-27。社長の「画像生成した時のトークンも計算してほしい」）。
   *
   * トークンは足して1つにする（社長が見る「使ったぶん」は会社の合計）。
   * **原価だけは別々に数える** — 画像の出力トークンは文字のモデルの25倍あるので、
   * 混ぜると 1/25 に記帳されて残高が嘘になる（前に「0 で記帳」で同じ穴を踏んでいる → 0034）。
   */
  const bill = () => ({
    tokensIn: usage.in + picUse.in,
    tokensOut: usage.out + picUse.out,
    costCents: (billedCostUsd('standard', usage.in, usage.out, pref.model)
      + imageCostUsd(picUse.model, picUse.in, picUse.out)) * 100,
  });
  let wrote: string | undefined;
  /** 書いた成果物の id（**品質担当がその場で差し戻す**ために要る） */
  let delId: string | null = null;
  let bodyText = '';
  let decision: { question: string; why: string; options: unknown[] } | undefined;
  let finished = false;
  /** 最後の往復の終わり方（`end_turn` / `max_tokens` / `content_filter` …） */
  let stop: string | null = null;
  const learned: string[] = [];
  /** 社員が書いた手順書（Hermes の輪）。**往復の外で1回だけ書く** */
  let newSkill: { filename: string; name: string; desc: string; body: string } | null = null;
  /** 渡した手順書への直しの提案（**渡していないものは指せない**） */
  const edits: { id: string; body: string; why: string }[] = [];
  /**
   * **前の成果物・決定と食い違うと気づいたこと**（2026-08-26）。
   * 前は黙って上書きするしかなかった — 憲法には「矛盾に気づいたら書き残す」と
   * 書いてあるのに、**書き残す先がどこにも無かった**。
   */
  const conflicts: string[] = [];

  try {
    /**
     * 文脈: 定義（誰か）→ 会社の状況（何のためか）→ タスク（何をするか）。
     * **同じフェーズの済んだ成果物を渡す** — 受け渡しの最小形（本格化は Phase 9）。
     */
    /**
     * **同じフェーズだけに絞っていた**（2026-08-25 に広げた）。
     * 絞ると、戦略フェーズの担当は調査フェーズが書いたものを**1文字も見ずに**始める —
     * 承認済みの索引（`memory`）はタイトルしか渡さないので、中身はどこからも届かなかった。
     * この Work の中はぜんぶ地続きなので、済んだタスクの成果物を新しい順に3件渡す
     * （差し戻されたものは渡さない — 直っていないものを土台にさせない）。
     */
    const prior = (work.dels ?? [])
      .filter((d) => d.state !== '差し戻し'
        && work.tasks.some((t) => t.id === d.taskId && t.state === 'done'))
      .slice(0, 3);

    /**
     * **つないだ道具**（MCP・Phase 12。2026-08-25）。
     * 会社が1つもつないでいなければ空 — そのときは何も変わらない。
     */
    const ready = await readyTools().catch(() => null);

    /** **調べる仕事か**（Web を見てよい社員）。名簿の2人だけ */
    const looksUp = task.owner === '調査担当' || task.owner === '分析担当';
    /**
     * **絵を描ける人か**（2026-08-27）。デザイン担当で、会社が絵を入れていて、鍵があるとき。
     * 依頼文と道具の両方がこれを見る — **説明にだけ出て道具が無い**、を作らない。
     */
    const canDrawHint = task.ownerSlug === 'visual-designer' && await imagesOn();

    const system = [
      personaOf(task.ownerSlug ?? '', task.owner ?? 'AI社員'),
      // **社長が上げたルールは、定義のすぐあと**（毎回効く制約なので頭に置く）
      ...(myRules.length ? ['', '社長が決めたルール（**毎回守る**）:', ...myRules.map((r) => `- ${r}`)] : []),
      '',
      '道具の使い方:',
      '1. log_step で作業の区切りを3〜6回記録する（progress は正直に）',
      '2. 成果物を1つ書く — write_deliverable か、'
      + '**手順や承認の流れなら draw_workflow で図にする**（どちらか一方）',
      ...(canDrawHint ? ['   **絵そのものを頼まれているなら make_image で1枚出す**（これも代わりになる）。'
        + '**説明で終わらせない** — ロゴを頼まれたらロゴを出す'] : []),
      '   **出す形は、社長がそのまま使える形にする** — '
      + '表計算に入れる数字は kind=csv、公開するページは kind=page（1枚のHTML）、'
      + '読んで判断してもらうものは kind=report。**迷ったら report**',
      '   社長はこれを見て、進めていいかを決める。'
      + '**見せる相手がいるつもりで書く**（社内メモにしない）',
      '3. 事業の判断（価格・対象など）に当たったら ask_decision で止まる',
      '4. 次も効く学びがあれば note_learning で1行だけ書き残す（任意）',
      '5. 渡されたものと**食い違う**ことに気づいたら flag_conflict で上げる（任意。自分で決めない）',
      '6. **同じ形の仕事がまた来ると分かったら** write_skill で手順書を残す（任意）。'
      + '渡された手順書に足りないところがあったら improve_skill で直す（任意）。'
      + '**どちらも統括AIが読んでから、会社のものになります**',
      '7. 最後に finish。**文章では答えない** — すべて道具で',
    ].join('\n');

    const messages: Msg[] = [{
      role: 'user',
      content: [
        `この Work のゴール: ${work.goal}`,
        `いまのフェーズ: ${phase?.name ?? ''} — ${phase?.goal ?? ''}`,
        ...(decided.length
          ? ['', '決めたこと（社長の決定。**これに沿う**）:',
             ...decided.map((d) => `- ${d.question} → ${d.chosen}`)]
          : []),
        ...(prior.length
          ? ['', 'この Work でここまでに出来ているもの（前のフェーズのぶんも含む。**土台にする**）:',
             ...prior.map((d) => `--- ${d.title} ---\n${(d.body ?? d.preview ?? '').slice(0, 3000)}`)]
          : []),
        ...(skills.length
          ? ['', 'スキル（この会社の手順書。これに沿って進める。'
              + '**足りないところがあれば improve_skill で直せます**）:',
             ...skills.map((x) => `--- ${x.name}（id: ${x.id}）---\n${(x.body ?? '').slice(0, 2000)}`)]
          : []),
        ...(lessons.length
          ? ['', 'これまでの学び（自分のメモ。同じ判断を繰り返さない）:',
             ...lessons.map((l) => `- ${l}`)]
          : []),
        ...(memory.length
          ? ['', '会社でこれまでに承認された成果物（重複して作らない。要るなら前提として使う）:',
             ...memory.map((x) => `- ${x.title}（${x.workTitle}）`)]
          : []),
        ...recallBlock(memos),
        ...founderBlock(founder),
        ...(/ を直す$/.test(task.title)
          ? ['', `成果物のタイトルは「${task.title.replace(/ を直す$/, '')}」のまま出す（直した新しい版になる）`,
             /**
              * **差し戻しを、手順書に返す**（2026-08-26。Hermes の「使いながら良くなる」）。
              * 前は指摘が担当の**学び**にしか残らず、
              * **その仕事の土台になった手順書は直らないまま**だった。
              * 直しのタスクには同じ手順書が載る（題が同じなので同じものが当たる）ので、
              * ここで一言添えるだけで輪が閉じる — **覚えておく場所を増やさずに済む**。
              */
             ...(skills.length
               ? ['**この手順書に沿って作ったものが差し戻されました。**'
                  + '手順書のほうに足りないところがあったなら、improve_skill で直してください'
                  + '（社長の指摘が、あなた1人の記憶で終わらないように）。'
                  + '手順書は悪くなかったのなら、直さなくて構いません']
               : [])]
          : []),
        ...(ready ? toolsLine(ready) : []),
        '',
        `あなたのタスク: ${task.title}`,
        `やること: ${task.intent || task.title}`,
        '',
        '道具を順に使って、このタスクを最後までやってください。',
      ].join('\n'),
    }];

    /** 図の下書き（道具から来た生の値）。**通ってから成果物にする** */
    let drawn: Record<string, unknown> | null = null;
    /** 絵の頼み（`make_image` の引数）。**往復の外で**描いてもらう */
    let picture: Record<string, unknown> | null = null;

    /**
     * **つないだ道具があるときだけ、往復する。**
     *
     * 1タスク＝1往復は、道具が全部「書き残す」系だったから成り立っていた
     * （→ CLAUDE.md「Web調査のような『読む』道具が入るときに初めてループが要る」）。
     * MCP は**読む道具**なので、読んだ結果を見てから書くことになる。
     * つないでいない会社ではこれまでどおり1往復 — **払う理由が無いのに往復しない**。
     */
    /**
     * **絵の道具は、描ける人にだけ渡す**（2026-08-27）。
     * 会社が入れていない（従量課金の栓がオフ）／鍵が無い ときは渡さない —
     * 持っていない道具の説明を読ませると、呼んで失敗するだけになる。
     */
    const base = canDrawHint ? [...RUN_TOOLS, makeImage] : RUN_TOOLS;
    const tools = ready?.defs.length
      ? [...base, ...ready.defs.map((d) => ({
          name: d.name, description: d.description,
          input_schema: d.input_schema as ToolDef['input_schema'],
        }))]
      : base;
    const rounds = ready?.defs.length ? MCP_ROUNDS : 1;

    for (let round = 1; round <= rounds; round++) {
    /** この往復で呼ばれた、つないだ道具（結果を次の往復に渡す） */
    const called: { name: string; args: Record<string, unknown> }[] = [];

    for await (const c of pick().stream({
      tier: 'standard', model: pref.model, effort: pref.effort,
      /**
       * **調べる仕事のときだけ Web を見る**（2026-08-26。社長が押していれば）。
       * 検索は従量で課金されるので、全部の社員に付けない —
       * 調査担当と分析担当は「調べないと嘘になる」仕事なので、ここだけ開ける
       * （憲法の「渡されていないなら『未確認』と印を付ける」が、ここで本当に外れる）。
       */
      web: looksUp && (await webOn()),
      system, messages, tools, maxTokens: 8000,
    })) {
      if (c.type === 'tool_use') {
        const a = (c.input ?? {}) as Record<string, unknown>;
        if (ready && c.name.startsWith(TOOL_PREFIX)) {
          called.push({ name: c.name, args: a });
        } else if (c.name === 'log_step') {
          await s.addStep(runId, {
            seq: ++seq, kind: 'tool_use', tool: 'log_step',
            summary: String(a.title ?? ''), progress: clamp(a.progress),
          });
        } else if (c.name === 'write_deliverable') {
          wrote = String(a.title ?? task.title);
          bodyText = String(a.body ?? '');
          delId = await s.addDeliverable({
            workId: work.id, taskId, employeeId: task.ownerId,
            title: wrote, kind: String(a.kind ?? 'doc'), body: String(a.body ?? ''),
          });
          await s.addStep(runId, {
            seq: ++seq, kind: 'tool_use', tool: 'write_deliverable', summary: `${wrote} を書いた`,
          });
        } else if (c.name === 'make_image') {
          picture = a;                        // 絵は往復の外でもらう（時間がかかる）
        } else if (c.name === 'draw_workflow') {
          drawn = a;                          // 検証してから成果物にする（往復の外で）
        } else if (c.name === 'ask_decision') {
          decision = {
            question: String(a.question ?? '判断してください'),
            why: String(a.why ?? ''),
            options: Array.isArray(a.options) ? a.options : [],
          };
        } else if (c.name === 'note_learning') {
          const lesson = String(a.lesson ?? '').trim();
          if (lesson) learned.push(lesson.slice(0, 60));
        } else if (c.name === 'flag_conflict') {
          const what = String(a.what ?? '').trim();
          if (what) conflicts.push(what.slice(0, 120));
        } else if (c.name === 'write_skill') {
          const nm = String(a.name ?? '').trim().slice(0, 24);
          const bd = String(a.body ?? '').trim();
          // **1タスクで1枚まで。** 書き散らかされると、通す側も読む側も溺れる
          if (nm && bd && !newSkill) {
            newSkill = {
              filename: String(a.filename ?? nm), name: nm,
              desc: String(a.when ?? '').trim().slice(0, 80), body: bd.slice(0, 8000),
            };
          }
        } else if (c.name === 'improve_skill') {
          const id = String(a.skill ?? '');
          const bd = String(a.body ?? '').trim();
          // **渡した手順書だけ直せる。** id を当てずっぽうで書かれても他の行に届かない
          if (bd && skills.some((x) => x.id === id) && !edits.some((e) => e.id === id)) {
            edits.push({ id, body: bd.slice(0, 8000), why: String(a.why ?? '').trim().slice(0, 120) });
          }
        } else if (c.name === 'finish') {
          finished = true;
          await s.addStep(runId, {
            seq: ++seq, kind: 'message', summary: String(a.summary ?? '完了'), progress: 100,
          });
        }
      } else if (c.type === 'done') {
        usage.in += c.usage.inputTokens;
        usage.out += c.usage.outputTokens;
        // **どう終わったかを覚えておく。** 書けなかったときに、
        // 「書かなかった」のか「途中で切れた／断られた」のかを言い分けるため
        stop = c.stopReason ?? stop;
      }
    }

    /**
     * 成果物まで書けたか、判断で止まったなら、そこで終わり（道具を呼んでいても続けない）。
     * 何も呼ばなかったときも終わり — 続ける理由が無い。
     */
    if (!called.length || wrote || drawn || decision || finished) break;

    /**
     * **結果は「社長の発言」として渡す。**
     * 器（`Msg`）は role と文字しか持たない — 道具の往復を本物の形で入れるには
     * 3つの通り道（Anthropic / OpenAI / OpenRouter）ぜんぶを直すことになる。
     * ここでやりたいのは「読んだものを見せて、続きを書かせる」だけなので、
     * **宙に浮いた tool_call を作らない**この形のほうが安全でもある。
     */
    const results: string[] = [];
    for (const call of called) {
      const r = await runTool(ready!, call.name, call.args);
      await s.addStep(runId, {
        seq: ++seq, kind: 'tool_use', tool: call.name,
        summary: r.ok ? `${call.name} を呼んだ` : `${call.name} — ${r.error}`,
      });
      results.push(`--- ${call.name} ---\n${r.ok ? r.text : `呼べませんでした: ${r.error}`}`);
    }
    messages.push({
      role: 'user',
      content: ['呼んだ道具の結果です:', ...results, '',
                '**これを踏まえて、このタスクを最後までやってください。**'
                + '足りなければもう一度呼んでいいですが、'
                + '**分かった範囲で成果物を書くほうが先**です。'].join('\n'),
    });
    }

    /**
     * **セントは整数ではない**（2026-08-26 → `0034`）。
     * 2,000トークンの往復は 0.06 セントほどなので、`Math.round` すると **0 になる** —
     * 本番の最初の会社は、6回とも 0 で記帳されていた。
     * `run_ledger`（0014）は `cost_cents > 0` のときだけ台帳に落とすので、
     * **台帳に1行も入らず、残高も1日の上限も永久に効かない**。端数を捨てない。
     */

    // 読んだスキルと書いた学びを残す（失敗しても実行は倒さない）
    if (skills.length) await s.bumpSkillUse(skills.map((x) => x.id)).catch(() => {});
    if (learned.length && task.ownerId) await s.addLearnings(task.ownerId, learned).catch(() => {});

    /**
     * **社員が書いた手順書は、統括AIが通すまで誰にも読まれない**（2026-08-26）。
     * ここで書き込んで、そのまま1往復で見てもらう — **社長を待たせない**。
     * 倒れても実行は倒さない（手順書は成果物ではない）。
     */
    let touched = false;
    if (newSkill) {
      const made = await writeSkillRow(s, newSkill, task.ownerId);
      if (made) {
        touched = true;
        await s.addStep(runId, {
          seq: ++seq, kind: 'tool_use', tool: 'write_skill',
          summary: `手順書「${newSkill.name}」を書いた（統括AIが見ます）`,
        }).catch(() => {});
      }
    }
    for (const e of edits) {
      await s.proposeSkillEdit(e.id, e.body, e.why, task.ownerId).catch(() => {});
      touched = true;
      await s.addStep(runId, {
        seq: ++seq, kind: 'tool_use', tool: 'improve_skill',
        summary: `手順書を直したい — ${e.why || '足りないところがあった'}`,
      }).catch(() => {});
    }
    if (touched) await reviewSkills().catch(() => {});

    /**
     * **食い違いは、社長に上げる。** 社員は決められない（憲法の
     * 「社長の代わりに事業判断をしない」）ので、気づいたことをそのまま渡す。
     */
    for (const what of conflicts.slice(0, 2)) {
      await s.addStep(runId, {
        seq: ++seq, kind: 'message', tool: 'flag_conflict', summary: `食い違いに気づいた — ${what}`,
      }).catch(() => {});
      await s.addNotification({
        kind: '要確認',
        body: `${task.owner ?? 'AI社員'}が食い違いに気づきました — ${what}`,
        subjectType: 'task', subjectId: taskId,
      }).catch(() => {});
    }
    // **溜まっていたら畳む**（`tendMemory` は満杯に近いときだけモデルを呼ぶ）
    await tendMemory(task.ownerId).catch(() => {});

    if (decision) {
      // 判断で止まる。失敗ではないので run は done、タスクは needs_decision
      await s.finishRun(runId, { status: 'done', ...bill(), model: usedModel });
      await s.markDecision(taskId, decision);
      return { ok: 'decision', question: decision.question };
    }

    /**
     * **絵は、往復の外でもらう**（2026-08-27。社長の「ロゴ作る時は GPT の AI を」）。
     *
     * 往復の中で待たない理由は2つ — 1枚に十数秒かかるのと、
     * **文字のモデルと絵のモデルは別のところに聞く**から（`lib/ai/image.ts`）。
     * 1タスク＝1往復は崩れない（絵を頼むのは1回だけ）。
     *
     * **描けなかったら、正直に失敗する。** 中身の無い画像の成果物を作らない —
     * 社長は開いて初めて空だと気づくことになる。戻り道（もう一度やる / 飛ばす）は
     * いつもどおり残る。
     */
    /**
     * **描ける人が、描かずに書いて終わったら、1回だけ描き直してもらう**（2026-08-27）。
     *
     * これは**本番でいちばん起きる壊れ方**そのもの — 「ロゴを作って」と頼まれたモデルは、
     * 放っておくと**ロゴの説明**を書いて満足する（デザイン担当の Critical Rule に
     * 「説明で終わらせない」と書いてあっても守られない）。
     * 決め打ちのプロバイダも1回目はそうする。
     *
     * 直し方はこの repo にもう答えがある — `rewrite` / `redraw` / 会話の `push` と同じで、
     * **道具を1つに絞って `toolChoice: 'required'` で頼み直す。1回だけ。**
     */
    const drafted = wrote;
    if (canDrawHint && !picture && drafted) {
      const ask: Msg[] = [...messages, { role: 'user', content: [
        `「${task.title}」で頼まれているのは**絵そのもの**です。文章では代わりになりません。`,
        'make_image を1回だけ呼んで、実際の画像を1枚出してください。',
        `いま書いた「${drafted}」の中身を、そのまま prompt に写して構いません（英語で）。`,
        `**title は「${drafted}」のままにしてください。**`,
      ].join('\n') }];
      for await (const c of pick().stream({
        tier: 'standard', model: pref.model, effort: pref.effort,
        system, messages: ask, tools: [makeImage], toolChoice: 'required', maxTokens: 4000,
      })) {
        if (c.type === 'tool_use' && c.name === 'make_image') picture = (c.input ?? {}) as Record<string, unknown>;
        if (c.type === 'done') { usage.in += c.usage.inputTokens; usage.out += c.usage.outputTokens; }
      }
      /**
       * 絵が来たなら、**さっき書いた文章は下書きだった**ことにする。
       * 消す口は作らない — **同じ題なら新しい版になる**という版の仕掛けが
       * 最初からあるので（0001 の lineage_id / superseded）、
       * 題を揃えるだけで文章のほうは一覧から隠れる。**成果物は1つに見える。**
       */
      if (picture) { picture.title = drafted; wrote = undefined; }
    }

    if (picture && !wrote) {
      const title = String(picture.title ?? task.title);
      const prompt = String(picture.prompt ?? '').trim();
      await s.addStep(runId, {
        seq: ++seq, kind: 'tool_use', tool: 'make_image', summary: `${title} を描いている`, progress: 80,
      });
      try {
        const pic = await draw(prompt, { model: await imageModel() });
        picUse.in += pic.usage.inputTokens;
        picUse.out += pic.usage.outputTokens;
        picUse.model = pic.model;
        wrote = title;
        // 本文は**何を頼んだか**。差し戻しのとき「前は何と言ったか」を読む場所になる
        bodyText = [String(picture.note ?? '').trim(), '', prompt].filter(Boolean).join('\n');
        delId = await s.addDeliverable({
          workId: work.id, taskId, employeeId: task.ownerId,
          title, kind: 'image', body: bodyText,
          image: { base64: pic.base64, mime: pic.mime },
        });
        await s.addStep(runId, {
          seq: ++seq, kind: 'tool_use', tool: 'make_image', summary: `${title} を出した`,
        });
      } catch (e) {
        const why = `絵を出せませんでした — ${e instanceof Error ? e.message : String(e)}`;
        await s.finishRun(runId, {
          status: 'failed', ...bill(),
          model: usedModel, error: why,
        });
        await s.addNotification({
          kind: 'エラー', body: `${task.title} — ${why}`, subjectType: 'task', subjectId: taskId,
        });
        return { ok: false, error: why };
      }
    }

    /**
     * **図は、検証を通ってから成果物になる**（archify の validate → deliver と同じ順）。
     * 絵が壊れる診断（線の先がいない・同じ場所に2つ…）が出たら、
     * **何が悪いかを渡して、もう一度だけ**描いてもらう。それでも壊れているなら、
     * 通らなかったと正直に言う（壊れた図を成果物にしない）。
     * 読みにくいだけの診断は、直らなかったこととして成果物に残す。
     */
    if (drawn) {
      let wf = toWorkflow(drawn);
      let diags = checkWorkflow(wf);
      if (fatalOf(diags).length) {
        const again = await redraw(pick(), system, messages, wf, diags, pref, usage);
        if (again) { wf = again; diags = checkWorkflow(wf); }
      }
      const fatal = fatalOf(diags);
      if (fatal.length) {
        const why = `図が通りませんでした — ${fatal[0].rule}`;
        await s.finishRun(runId, {
          status: 'failed', ...bill(),
          model: usedModel, error: why,
        });
        await s.addNotification({
          kind: 'エラー', body: `${task.title} — ${why}`, subjectType: 'task', subjectId: taskId,
        });
        return { ok: false, error: why };
      }
      wrote = wf.meta.title;
      bodyText = wf.meta.title;                 // 統括AIのレビューは題だけ見る（図に本文は無い）
      await s.addDeliverable({
        workId: work.id, taskId, employeeId: task.ownerId,
        title: wrote, kind: 'diagram', body: packDoc(wf, diags),
      });
      await s.addStep(runId, {
        seq: ++seq, kind: 'tool_use', tool: 'draw_workflow', summary: `${wrote} を描いた`,
      });
    }

    /**
     * **書かなかったら、その場でもう一度だけ頼む**（2026-08-26）。
     *
     * 本番の最初の会社で、**6回の実行が6回とも**ここで落ちていた
     * （`成果物が書かれませんでした`・出力は約100トークン・道具は1つも呼ばれず）。
     * つまりこれは「弱いモデルがたまに文章で答える」ではなく、**ふつうの振る舞い**だった —
     * 速いモデル（standard）は、道具を渡されても本文で答えることのほうが多い。
     *
     * 会社としては、**社長が毎回「もう一度やる」を押す**のは成立しない。
     * 直し方はこの repo にもう答えがある — 図の `redraw` と、会話の push と同じで、
     * **道具を1つに絞って `toolChoice: 'required'` で頼み直す**
     * （→ CLAUDE.md「『必ず使え』と書くだけでは守られない。道具が1つなら
     * 出力は必ずその形になる」）。**1回だけ**。それでも書かなければ正直に失敗する。
     */
    /**
     * **`finish` だけ呼んで終わった往復も、ここに入れる。**
     * 出すものが無いのにタスクだけ done になると、フェーズは閉じるのに
     * 社長の手もとには何も残らない — 「何も起きなかった」がいちばん分かりにくい。
     */
    if (!wrote) {
      const late = await rewrite(pick(), system, messages, task.title, pref, usage);
      if (late) {
        wrote = late.title;
        bodyText = late.body;
        delId = await s.addDeliverable({
          workId: work.id, taskId, employeeId: task.ownerId,
          title: wrote, kind: late.kind, body: late.body,
        });
        await s.addStep(runId, {
          seq: ++seq, kind: 'tool_use', tool: 'write_deliverable', summary: `${wrote} を書いた`,
        });
      }
    }

    if (!wrote && !finished) {
      /**
       * 頼み直しても書かなかった。**正直に失敗する**（「もう一度やる」で社長が戻せる）。
       *
       * **どう終わったかで言い分ける** — 途中で切れたのと、断られたのと、
       * ただ書かなかったのは、社長にとって次の手が違う
       * （長さなら分割、断られたなら頼み方、それ以外はもう一度）。
       */
      const why = stop === 'max_tokens' || stop === 'length'
        ? '長すぎて途中で切れました'
        : stop === 'refusal' || stop === 'content_filter'
          ? 'この依頼には応えられないと返ってきました'
          : '頼み直しても成果物が書かれませんでした';
      await s.finishRun(runId, {
        status: 'failed', ...bill(),
        model: usedModel,
        error: why,
      });
      await s.addNotification({
        kind: 'エラー', body: `${task.title} — ${why}`,
        subjectType: 'task', subjectId: taskId,
      });
      return { ok: false, error: why };
    }

    await s.finishRun(runId, { status: 'done', ...bill(), model: usedModel });
    if (wrote) {
      /**
       * **品質担当が在籍していれば、社長に出す前に1度読む**（2026-08-26 → `lib/exec/qa.ts`）。
       * **直しの成果物は素通し**（1回だけ）— でないと品質担当と社員が延々と往復して、
       * 社長の見えないところで料金だけ増える。
       */
      const fix = / を直す$/.test(task.title);
      const qa = fix ? null
        : await reviewDeliverable(work, task, { title: wrote, body: bodyText }).catch(() => null);

      if (qa && !qa.ok && delId) {
        /**
         * **差し戻すのは、社長と同じ道**（`setDelStatus` → `addFixTask`）。
         * 2つ目の仕掛けを作らない。社長には**要確認ではなく、直していると出す** —
         * 見なくていいものを見せない。
         */
        const flipped = await s.setDelStatus(delId, 'rejected').catch(() => false);
        if (flipped) {
          const says = [qa.note, ...qa.fixes].filter(Boolean).join('\n');
          await s.addFixTask(work.id, { taskId, title: wrote }, says).catch(() => {});
          await s.addNotification({
            kind: '要確認',
            body: `${wrote} は品質担当が差し戻しました — ${qa.note}。直してからお見せします`,
            subjectType: 'task', subjectId: taskId,
          });
          return { ok: true, deliverable: wrote };
        }
      }

      /**
       * **通ったとき。** 品質担当がいれば、その一言は**確かめた結果**。
       * いなければ**統括AIのレビュー**（Phase 8）— fast の目で1度見て、どこを見ればいいかを添える。
       * 鍵が無い環境では黙って飛ばす（偽のレビューを作らない）。
       */
      const note = qa?.note || await execGlance(wrote, bodyText).catch(() => '');
      const by = qa ? '品質担当' : '統括AI';
      await s.addNotification({
        kind: '要確認',
        body: `${wrote} ができました — ${task.owner ?? 'AI社員'}${note ? `。${by}: ${note}` : ''}`,
        subjectType: 'task', subjectId: taskId,
      });
    }
    return { ok: true, deliverable: wrote };
  } catch (e) {
    // 途中で落ちても、そこまでに使ったぶんは正直に記帳する（0 にしない）
    await s.finishRun(runId, {
      status: 'failed', ...bill(),
      model: usedModel, error: say(e),
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
  if (!hasKey('fast')) return '';
  let out = '';
  // 話すのは統括AIなので**モデルは統括AIの設定**。深さは使わない（40字の一文）
  const { model } = await execPref();
  for await (const c of providerFor('fast').stream({
    tier: 'fast', model, effort: 'low', maxTokens: 300,
    system: 'あなたは一人社長の統括AI。部下の成果物を渡すとき、社長がどこを見ればいいかを日本語40文字以内の1文で添える。文だけ返す。',
    messages: [{ role: 'user', content: `成果物「${title}」:
${body.slice(0, 4000)}` }],
  })) {
    if (c.type === 'text') out += c.text;
  }
  return out.trim().slice(0, 60);
}

/**
 * 手順書のファイル名。**英数字が残らなければ番号にする** —
 * MCP の道具名で踏んだのと同じ事故（「テストの在庫」→ `______`）をここでも起こさない。
 * 同じ名前がもうあるなら `-2` `-3` と足して、3回で諦める（諦めても実行は倒れない）。
 */
async function writeSkillRow(
  s: ReturnType<typeof store>,
  x: { filename: string; name: string; desc: string; body: string },
  authorId?: string,
): Promise<string | null> {
  const base = x.filename.toLowerCase().replace(/\.md$/, '')
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  for (let i = 0; i < 3; i++) {
    const filename = `${base || 'skill'}${i ? `-${i + 1}` : ''}.md`;
    const id = await s.writeSkill({
      // **会社ぜんぶのものにする。** 会社が学ぶのであって、席が学ぶのではない
      employeeId: null, authorId, filename, name: x.name, desc: x.desc, body: x.body,
    }).catch(() => null);
    if (id) return id;
  }
  return null;
}

const clamp = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : undefined;
};

/**
 * **書かなかったときに、1回だけ書かせる。**
 *
 * 道具は `write_deliverable` **1つだけ**渡して `toolChoice: 'required'`。
 * `redraw`（図）と同じ形で、理由も同じ — 「必ず使え」と書くだけでは守られない。
 *
 * 本番では**6回中6回**ここが要った（速いモデルは本文で答えてしまう）。
 * 倒れたら `null` を返して、呼び元が正直に失敗にする。
 */
async function rewrite(
  p: ModelProvider, system: string, messages: Msg[], fallbackTitle: string,
  pref: { model?: string; effort?: string },
  usage: { in: number; out: number },
): Promise<{ title: string; kind: string; body: string } | null> {
  const ask: Msg[] = [...messages, {
    role: 'user',
    content: [
      'まだ成果物が書かれていません。**このタスクは成果物を出して終わりです。**',
      'いま分かっていることだけで構いません（足りないところは「要確認」と書いてください）。',
      'write_deliverable を1回だけ呼んで、社長がそのまま読める本文を書いてください。',
    ].join('\n'),
  }];
  let got: Record<string, unknown> | null = null;
  try {
    for await (const c of p.stream({
      tier: 'standard', model: pref.model, effort: pref.effort as never,
      system, messages: ask, tools: [writeDeliverable], toolChoice: 'required', maxTokens: 8000,
    })) {
      if (c.type === 'tool_use' && c.name === 'write_deliverable') got = (c.input ?? {}) as Record<string, unknown>;
      if (c.type === 'done') { usage.in += c.usage.inputTokens; usage.out += c.usage.outputTokens; }
    }
  } catch { return null; }
  const body = String(got?.body ?? '').trim();
  if (!body) return null;                 // 呼んだが中身が空。**空の成果物を作らない**
  return {
    title: String(got?.title ?? fallbackTitle) || fallbackTitle,
    kind: String(got?.kind ?? 'report'),
    body,
  };
}

/**
 * 図を1回だけ描き直してもらう。**道具は `draw_workflow` 1つだけ渡す** —
 * 「必ず使え」と書くだけでは守られないので、道具を1つに絞る
 * （→ CLAUDE.md「push の往復はその道具しか渡さない」）。
 *
 * 直すのは**診断が指したところだけ**（archify の「診断された対象だけ直す」）。
 */
async function redraw(
  p: ModelProvider, system: string, messages: Msg[],
  wf: Workflow, diags: Diag[], pref: { model?: string; effort?: string },
  usage: { in: number; out: number },
): Promise<Workflow | null> {
  const ask: Msg[] = [...messages, {
    role: 'user',
    content: [
      'いま描いた図に、絵が壊れるところがありました。',
      sayDiags(diags),
      '',
      '**指されたところだけ**直して、draw_workflow をもう一度呼んでください。',
      'ほかは変えないでください。',
      '',
      `いまの図: ${JSON.stringify({ ...wf, meta: wf.meta })}`,
    ].join('\n'),
  }];
  let got: Record<string, unknown> | null = null;
  try {
    for await (const c of p.stream({
      tier: 'standard', model: pref.model, effort: pref.effort as never,
      system, messages: ask, tools: [drawWorkflow], toolChoice: 'required', maxTokens: 6000,
    })) {
      if (c.type === 'tool_use' && c.name === 'draw_workflow') got = (c.input ?? {}) as Record<string, unknown>;
      if (c.type === 'done') { usage.in += c.usage.inputTokens; usage.out += c.usage.outputTokens; }
    }
  } catch { return null; }              // 描き直せなかった。呼び元が正直に失敗にする
  return got ? toWorkflow(got) : null;
}
