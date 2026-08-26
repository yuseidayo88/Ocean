import type { Chunk, ModelProvider, RunInput } from './provider';
import { EMPTY_USAGE } from './provider';

/**
 * **キーが無いときのプロバイダ。**
 *
 * `ANTHROPIC_API_KEY` も `OPENAI_API_KEY` も無い環境（開発・デモ）で、
 * 統括AIの通り道そのものは動かしたい。ここが返すのは**決め打ち**で、
 * 考えていない。だから画面には必ず「これは仮の計画です」と出す。
 *
 * **本物と同じ道を通す**のが目的なので、返すのは文章ではなく
 * `tool_use`（本物と同じ道具・同じ形）。パースやDB書き込みの穴は、これで見つかる。
 */
export class FakeProvider implements ModelProvider {
  readonly vendor = 'fake';

  async *stream(input: RunInput): AsyncIterable<Chunk> {
    // **本物と同じ順で流す。** 道具は「名前が先、引数があと」で届く
    for await (const c of this.raw(input)) {
      if (c.type === 'tool_use') yield { type: 'tool_begin', name: c.name };
      yield c;
    }
  }

  private async *raw(input: RunInput): AsyncIterable<Chunk> {
    const goal = lastUser(input);
    const want = new Set((input.tools ?? []).map((t) => t.name));
    /**
     * **計画の道では、ゴールの行だけを見る**（2026-08-26）。
     *
     * 依頼文まるごとを見ていたので、引き直しの頼み文に入っていた
     * 「フェーズの**名前**と同じ字で書いてください」の「名前」が
     * `SHORT_ONE`（ロゴ・バナー・名前…）に当たり、**長い計画の引き直しが
     * 短い計画になって返っていた**。決め打ちの側の事故だが、
     * これがあると検査は「引き直しが動いている」を測れない。
     */
    const planGoal = lastText(input).match(/社長のゴール:\s*\n?(.+)/)?.[1]?.trim() || goal;

    // ══ 道具なし＝会話（チャットの返事）══ 偽物であることを必ず言う
    if (!input.tools?.length) {
      yield { type: 'text', text: `（仮の返事）${chatWords(input, goal)}` };
      yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'end_turn' };
      return;
    }

    // ══ AI社員の実行（Phase 7）══ 統括AIの道具が無く log_step があるときはこちら
    if (!want.has('decide_container') && want.has('log_step')) {
      yield* fakeRun(input);
      return;
    }

    // ══ 次のフェーズのタスク（Phase 9）══
    if (want.has('draft_phase_tasks')) {
      const phase = lastText(input).match(/次のフェーズ: (.+?) —/)?.[1] ?? '';
      yield tool('draft_phase_tasks', { tasks: nextTasks(phase) });
      yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
      return;
    }

    // ══ 道具を1つに絞られた往復（続きの仕掛け → lib/exec/reply.ts）══
    // 絞られているときは**必ずその道具**を使う（本物は toolChoice: required で同じ振る舞い）
    if (input.tools?.length === 1) {
      const only = input.tools[0].name;
      const said = lastText(input);
      const cur = readCur(input.system ?? '');
      if (only === 'set_conditions') {
        yield tool('set_conditions', condFrom(said));
        yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
        return;
      }
      if (only === 'ask') {
        yield tool('ask', { questions: askSet(cur) });
        yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
        return;
      }
      if (only === 'propose_candidates') {
        yield tool('propose_candidates', { candidates: fakeCands({ ...cur, ...condFrom(said) }) });
        yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
        return;
      }
      /**
       * **図の描き直し**（`lib/run/worker.ts` の `redraw`）。
       * 1回目はわざと壊してあるので、ここで**指されたところだけ**直した形を返す。
       * 本物と同じ壊れ方を通さないと、直す仕掛けが動いているか分からない。
       */
      if (only === 'draw_workflow') {
        yield tool('draw_workflow', wfDraw(true));
        yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
        return;
      }
      /**
       * **計画の引き直し**（`lib/exec/run.ts` の `drawPlan`）。
       * 1回目はわざと辻褄を壊してあるので、ここで**指されたところだけ**直す。
       */
      if (only === 'draft_plan') {
        yield tool('draft_plan', plan(planGoal, fixing(input)));
        yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
        return;
      }
      /**
       * **手順書の審査**（`lib/exec/skills.ts`）。社員が書いたものを統括AIが読む。
       * **1枚は落とす** — 全部通す決め打ちだと「落ちる道」が検査に出てこない。
       * 落とすのは「直しの提案」のほう（新しい手順書は通す）。
       */
      /**
       * **品質担当の判定**（`lib/exec/qa.ts`）。社長に出す前に成果物を1度読む。
       * **1件だけ差し戻す** — 全部通す決め打ちだと、門が効いているのか
       * ただ素通ししているのかが検査に出てこない。
       * 差し戻すのは「対象を1つに絞る」の成果物（社長が触らないもの）。
       */
      if (only === 'judge_deliverable') {
        const said = lastText(input);
        const bad = /タスク: 対象を1つに絞る/.test(said);
        yield tool('judge_deliverable', bad
          ? { ok: false, note: '絞った理由の根拠が書かれていません',
              fixes: ['「分かったこと」の節に、なぜその対象に絞れるのかを、調査のどの数字から言えるのかまで書く'] }
          : { ok: true, note: '要確認 の1件だけ先に見てください' });
        yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
        return;
      }
      if (only === 'review_skills') {
        /**
         * **落とす道も通す。** 全部通す決め打ちだと、審査が効いているのか
         * ただ素通ししているのかが検査に出てこない。
         * 落とすのは**本物の基準のひとつ**「この1回の結果ではなく、やり方が書いてあるか」で、
         * 決め打ちの社員は「今回の…」という名前の手順書をわざと1枚書く。
         */
        const verdicts = lastText(input).split('--- id: ').slice(1).map((blk) => {
          const id = blk.slice(0, blk.indexOf(' ---'));
          const name = blk.match(/名前: (.+)/)?.[1]?.trim() ?? '';
          const isNew = /種類: 新しい手順書/.test(blk);
          if (!isNew) return { id, keep: false, note: '' };
          return /^今回/.test(name)
            ? { id, keep: false, note: 'この1回の結果で、やり方が書かれていません' }
            : { id, keep: true, note: '' };
        });
        yield tool('review_skills', { verdicts });
        yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
        return;
      }
    }

    // ══ チャット（道具を全部持っている）══ 先に見る
    if (want.has('propose_work')) {
      yield* fakeChat(input);
      return;
    }

    // ══ 入口 Case B — 条件を集めて候補を出す ══
    if (want.has('propose_candidates')) {
      yield* fakeDiscover(input);
      return;
    }

    // ══ 入口 Case D — 取り込んだものから診断する ══
    if (want.has('report_diagnosis')) {
      yield* fakeDiagnose(input);
      return;
    }

    if (want.has('decide_container')) {
      yield tool('decide_container', container(planGoal));
    }
    if (want.has('ask')) {
      yield tool('ask', { questions: questions(planGoal) });
    }
    if (want.has('propose_hires')) {
      yield tool('propose_hires', { hires: hires(planGoal) });
    }
    if (want.has('draft_plan')) {
      yield tool('draft_plan', plan(planGoal, fixing(input)));
    }
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
  }
}

let n = 0;
/** **1回だけわざと失敗させる**ための覚え（タスク名）。→ `fakeRun` の同じ名前 */
const brokeOnce = new Set<string>();
const tool = (name: string, inputValue: unknown): Chunk =>
  ({ type: 'tool_use', id: `fake-${++n}`, name, input: inputValue });

/**
 * AI社員の1タスク（決め打ち）。**本物と同じ4道具・同じ順**で返すので、
 * runner のパース・DB書き込み・通知・進捗導出の穴はこれで見つかる。
 * 歩みのあいだに少し待つ — 画面のポーリングが「流れて見える」ことまで確かめられる。
 */
async function* fakeRun(input: RunInput): AsyncIterable<Chunk> {
  const text = lastText(input);
  // タスク名は**最初の発言**にある（道具の結果は後から user として足されるので）
  const all = input.messages.map((m) => m.content).join('\n');
  const task = all.match(/あなたのタスク: (.+)/)?.[1]?.trim() ?? '作業';
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /**
   * **つないだ道具を呼ぶ道**（MCP・Phase 12 の確かめ用）。
   * 会社が MCP をつないでいると、道具の一覧に `mcp__…` が混ざってくる。
   * **1度だけ呼んで、返ってきた文字を成果物に入れる** — 本物と同じ順
   * （読む → 書く）を通すので、往復の仕組みとその中身の受け渡しが両方確かめられる。
   */
  const mcp = (input.tools ?? []).find((t) => t.name.startsWith('mcp__'));
  if (mcp && !text.includes('呼んだ道具の結果です')) {
    yield tool('log_step', { title: `${mcp.name} で確かめる`, progress: 30 });
    await wait(300);
    yield tool(mcp.name, {});
    yield { type: 'done', usage: { ...EMPTY_USAGE }, stopReason: 'tool_use' };
    return;
  }
  if (mcp && text.includes('呼んだ道具の結果です')) {
    const got = text.slice(text.indexOf('---')).split('\n').slice(1, 4).join('\n').trim();
    yield tool('write_deliverable', {
      title: task.slice(0, 18), kind: 'report',
      body: [`# ${task}`, '', '## つないだ道具から読んだもの', '', got || '(空でした)', '',
             '> これは決め打ちの成果物です。'].join('\n'),
    });
    yield tool('finish', { summary: `${task} を終えた（つないだ道具を1つ読んだ）` });
    yield { type: 'done', usage: { ...EMPTY_USAGE }, stopReason: 'tool_use' };
    return;
  }

  /**
   * **1回だけ、わざと失敗する道**（2026-08-26）。
   *
   * **道具を1つも使わずに終わる** — 本物のモデルがいちばんよくやる壊れ方で、
   * worker はこれを `blocked` に落とす。止まったタスクが1つでも残ると
   * `closePhaseIfDone` はそのフェーズを閉じないので、**社長が押すまで会社は進まない**。
   *
   * 行儀よく書くと、**止まったタスクから戻る道が動いているか永久に分からない**
   * （図の1回目・計画の1回目・品質担当の差し戻しと同じ考え方）。
   * 2回目（＝社長が「もう一度やる」を押したあと）は、ふつうに書いて終わる。
   */
  // **その1本だけ。** 「◯◯ を直す」まで落とすと、直しタスクが止まって
  // フェーズが閉じず、検査が本筋と関係のないところで止まる（実際そうなった）
  if (task === '市場の大きさを出す' && !brokeOnce.has(task)) {
    brokeOnce.add(task);
    yield tool('log_step', { title: '統計を探した', progress: 20 });
    await wait(400);
    yield { type: 'done', usage: { ...EMPTY_USAGE }, stopReason: 'end_turn' };
    return;
  }

  /**
   * **判断で止まる道**（Phase 9 の確かめ用）。「絞る」仕事は、
   * 社長の決定がまだ文脈に無ければ ask_decision で止まる。
   * 決定が入っていれば（= 答えたあとの再実行）そのまま最後まで走る。
   */
  if (/絞る/.test(task) && !text.includes('決めたこと（社長の決定')) {
    yield tool('log_step', { title: '候補を3つに絞り込んだ', progress: 60 });
    await wait(700);
    yield tool('ask_decision', {
      question: '対象の絞り込み',
      why: '誰に売るかで、次のフェーズの調べ方と作るものが変わります。',
      options: [
        { label: 'K-POPファン層', description: '数が多く、SNSで届きやすい。単価は低め', recommended: true },
        { label: '就職・ビジネス層', description: '単価が高いが、決め手の実績が要る' },
        { label: '両方', description: '確かめる時間が2倍かかる' },
      ],
    });
    yield { type: 'done', usage: { ...EMPTY_USAGE }, stopReason: 'tool_use' };
    return;
  }

  /**
   * **図を描く道**（archify の形）。1回目は**わざと壊す** — 線の先に居ないノードを指す。
   * OneFound の検証がそれを見つけて、道具を1つに絞って描き直しを頼む。
   * 2回目（依頼文に「絵が壊れるところがありました」が入っている）で通る形を返す。
   * **本物と同じ壊れ方を通さないと、直す仕掛けが動いているか分からない。**
   */
  if (/流れ|手順|工程/.test(task)) {
    yield tool('log_step', { title: '主線を先に決めた', progress: 40 });
    await wait(600);
    yield tool('draw_workflow', wfDraw(false));
    await wait(300);
    yield tool('finish', { summary: '申込の流れを図にした' });
    yield { type: 'done', usage: { ...EMPTY_USAGE }, stopReason: 'tool_use' };
    return;
  }

  /**
   * **表（csv）とページ（html）の道**。本物と同じ形で出す —
   * 決め打ちの側だけ markdown で返していると、
   * 「csv なのに markdown の表を書く」という本番の壊れ方が検査に出てこない。
   */
  if (/価格|表|一覧|比較/.test(task)) {
    yield tool('log_step', { title: '数字を並べて突き合わせた', progress: 55 });
    await wait(600);
    yield tool('write_deliverable', {
      title: (task.match(/(.+) を直す$/)?.[1] ?? task).slice(0, 18), kind: 'csv',
      body: [
        '項目,月額,含まれるもの,備考',
        '入門,1980,"基本の機能, メール",要確認',
        '標準,4980,"基本の機能, 相談",おすすめ',
        '上級,9800,"すべて, 個別の相談",',
      ].join('\n'),
    });
    await wait(300);
    /**
     * **食い違いに気づく道も通す**（2026-08-26）。憲法には
     * 「矛盾に気づいたら黙って上書きしない」と書いてあるので、
     * **書き残す先があることを検査が確かめられる**ようにする。
     */
    yield tool('flag_conflict', {
      what: '調査の表では月額3,000円が相場だが、社長は月額1,980円で決めている',
    });
    yield tool('finish', { summary: `${task} を表にした` });
    yield { type: 'done', usage: { ...EMPTY_USAGE }, stopReason: 'tool_use' };
    return;
  }

  if (/LP|ページ|サイト|ランディング/.test(task)) {
    yield tool('log_step', { title: '見出しと申し込みの導線を決めた', progress: 55 });
    await wait(600);
    yield tool('write_deliverable', {
      title: (task.match(/(.+) を直す$/)?.[1] ?? task).slice(0, 18), kind: 'page',
      body: [
        '<!doctype html><html lang="ja"><head><meta charset="utf-8">',
        '<title>はじめる</title>',
        '<style>body{font-family:system-ui,sans-serif;margin:0;color:#111}'
        + '.h{padding:64px 32px;background:#0b1a2b;color:#fff}'
        + '.h h1{font-size:34px;margin:0 0 12px;font-weight:400}'
        + '.b{padding:40px 32px}.c{display:inline-block;padding:12px 20px;background:#1A73E8;color:#fff;border-radius:8px}</style>',
        '</head><body>',
        '<div class="h"><h1>はじめての一歩を、今日から。</h1><p>これは決め打ちの下書きです。</p></div>',
        '<div class="b"><p>ここに約束を3つ並べます。</p><span class="c">申し込む</span></div>',
        '</body></html>',
      ].join(''),
    });
    await wait(300);
    yield tool('finish', { summary: `${task} を1枚のページにした` });
    yield { type: 'done', usage: { ...EMPTY_USAGE }, stopReason: 'tool_use' };
    return;
  }

  const steps: [string, number][] = [
    [`${task} の段取りを決めた`, 15],
    ['材料を集めて表に並べた', 45],
    ['抜けている前提を「要確認」に振り分けた', 75],
  ];
  for (const [title, progress] of steps) {
    yield tool('log_step', { title, progress });
    await wait(900);
  }
  yield tool('write_deliverable', {
    // 直しのタスクは**元のタイトルのまま**出す（同じ lineage の新しい版になる）
    title: (task.match(/(.+) を直す$/)?.[1] ?? task).slice(0, 18), kind: 'report',
    body: [
      `# ${task}`,
      '',
      '> これは**決め打ちの成果物**です。モデルの鍵が無い環境で、実行の通り道を確かめるためのもの。',
      '',
      '## 分かったこと',
      '- 材料を3つの束に分けた（事実 / 推計 / 要確認）',
      '- 推計には前提を並べた。前提が2割ずれると結論も変わる',
      '',
      '## 要確認',
      '- 1件、確かめられなかった項目がある。次の判断の前に見てほしい',
    ].join('\n'),
  });
  await wait(400);
  // 学びの道も通す（本物と同じ道具・同じ順。E2E が「学びが残ること」を確かめられる）
  yield tool('note_learning', { lesson: '数字は事実・推計・要確認の3束に分けてから出す' });
  /**
   * **手順書の道も通す**（Hermes の輪。2026-08-26）。
   * 書くのは**1回だけ** — 2本目のタスクでも書くと、同じ filename で弾かれるだけになり、
   * 「書けたか」を測っているのか「弾かれたか」を測っているのか分からなくなる。
   * 目印は**タスク名**（`競合を並べて比べる` は決め打ちの1本目）。
   */
  // **直しのタスクでは書かない。** 同じ手順書が2枚できるだけで、
  // 検査は「書けたか」ではなく「二度書いたか」を測ることになる（実際そうなった）
  const first = !/ を直す$/.test(task);
  if (first && /競合/.test(task)) {
    yield tool('write_skill', {
      filename: 'compare-rivals.md', name: '競合の並べ方',
      when: '競合を比べる仕事のとき',
      body: ['# 競合の並べ方', '', '1. 5〜8社に絞る（多いと読めない）',
             '2. 価格 / 対象 / 強み / 弱み の4軸で表にする',
             '3. セルごとに出どころを残す。無いセルは「要確認」と書く'].join('\n'),
    });
  }
  /**
   * **落とされる側も1枚書く。** 本物のモデルは「この1回の結果」を手順書にしがちなので、
   * 決め打ちでも同じ間違いをする — そうしないと、審査が効いているか検査に出てこない。
   */
  if (first && /市場/.test(task)) {
    yield tool('write_skill', {
      filename: 'this-time-market.md', name: '今回の市場規模',
      when: '市場の大きさを聞かれたとき',
      body: '# 今回の市場規模\n\n上からの推計は 12万人、下からは 4万人だった。',
    });
  }
  /**
   * **直しの道も通す。** 手順書を渡されている往復では、1回だけ直しを出す
   * （決め打ちの審査はこれを**落とす**ので、「落ちる道」も検査に出る）。
   */
  /**
   * **差し戻されたときだけ直す**（2026-08-26）。本物と同じ引き金にする —
   * 依頼文に「この手順書に沿って作ったものが差し戻されました」が入っている往復。
   * 前は task 名で決め打ちしていたので、**輪が閉じているかを測れていなかった**。
   */
  const given = text.match(/--- .+?（id: ([^）]+)）---/);
  if (given && /差し戻されました/.test(text)) {
    yield tool('improve_skill', {
      skill: given[1], why: '出どころの残し方が書かれていなかった',
      body: '（決め打ちの直し）出どころは表のセルごとに残す。無ければ「要確認」と書く。',
    });
  }
  yield tool('finish', { summary: `${task} を終えた。成果物1件、要確認1件` });
  yield { type: 'done', usage: { ...EMPTY_USAGE }, stopReason: 'tool_use' };
}

/**
 * ゴールだけ取り出す。**プロンプト全文を読まない** —
 * 全文から題名を作ると「道具を順に呼んでください」まで題名に入る（実際そうなった）。
 */
const lastText = (i: RunInput) =>
  [...i.messages].reverse().find((m) => m.role === 'user')?.content ?? '';

const lastUser = (i: RunInput) => {
  const all = [...i.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  return all.match(/社長のゴール:\n([\s\S]*?)(?:\n\n|$)/)?.[1]?.trim() ?? all;
};

/** 終わりが言えるか。「伸ばしたい」「良くしたい」のような、終点の無い言い方を弾く */
const OPEN_ENDED = /(伸ばし|成長|改善|良く|うまく|なんとか|軌道に乗)/;
const SHORT_ONE = /(ロゴ|バナー|名前|コピー|見出し|アイコン)/;

function container(goal: string) {
  const ends = !OPEN_ENDED.test(goal) || /したい$/.test(goal) === false;
  const small = SHORT_ONE.test(goal);
  return {
    verdict: 'work',
    title: title(goal),
    goal: goal.replace(/。$/, ''),
    weeks: small ? 1 : 10,
    ends, alone: true, short: true,
    reason: small
      ? '小さいですが、終わりが言えて単独で価値があるので Work にします。'
      : '終わりが言えて、単独で価値があり、3ヶ月に収まるので Work にします。',
  };
}

/** 4〜20文字の見出し。社長の言葉をそのまま使う */
function title(goal: string) {
  const t = goal.replace(/[。、\n].*$/s, '').replace(/(を|が)?(作りたい|立ち上げたい|やりたい|したい|します)$/, '');
  return t.slice(0, 20) || '新しい Work';
}

function questions(goal: string) {
  return [
    {
      body: '誰に向けたものにしますか。',
      why: '対象が決まらないと、調べる範囲も作るものも決まりません。',
      options: [
        { label: '個人', description: '自分のために使う人。単価は低いが数が出る', recommended: true },
        { label: '会社', description: '仕事で使う人。単価は高いが決裁が要る' },
        { label: 'どちらも', description: 'まず片方で確かめてから広げる' },
      ],
    },
    {
      body: 'いつまでに形にしたいですか。',
      why: '締めが決まると、何を削るかが決まります。',
      options: [
        { label: '1ヶ月', description: 'いちばん小さい形で出す。確かめることを絞る', recommended: true },
        { label: '3ヶ月', description: 'ひととおり揃えてから出す' },
        { label: '決めていない', description: '先に何ができるかを見てから決める' },
      ],
    },
  ].slice(0, SHORT_ONE.test(goal) ? 1 : 2);
}

function hires(goal: string) {
  if (SHORT_ONE.test(goal)) return [];
  return [
    { definition_id: 'market-researcher', display_name: '調査担当',
      why: '市場と競合を調べる人がいません。', for_phase: '調査' },
    { definition_id: 'business-strategist', display_name: '戦略担当',
      why: 'いくらで売るかを決める人がいません。', for_phase: '戦略' },
    /**
     * **品質担当も採る**（2026-08-26）。在籍していないと
     * `reviewDeliverable` は何もしないので、**決め打ちで採らないと
     * 「社長に出す前に読む」の道が検査に一度も出てこない**。
     */
    { definition_id: 'quality-reviewer', display_name: '品質担当',
      why: '社長に出す前に、受け入れ条件と突き合わせる人がいません。', for_phase: '調査' },
  ];
}

/**
 * **辻褄を直してほしい、と頼まれている往復か**（`lib/exec/plan-check.ts`）。
 * 図の描き直しと同じ見分け方 — 依頼文にその1行が入っている。
 */
const fixing = (i: RunInput) =>
  i.messages.some((m) => m.content.includes('辻褄の合わないところがありました'));

function plan(goal: string, fixed = false) {
  if (SHORT_ONE.test(goal)) {
    return {
      weeks: 1,
      /**
       * **1回目は、人を集める仕事を先頭に置く**（2026-08-26。社長の
       * 「マーケティングを最後の方にして欲しい。最初に制作、準備をきちんとする」）。
       * 本物のモデルもよくこれをやる（「まず認知を取りましょう」）。
       * `checkPlan` の `market-first` がそれを見つけて、制作を先に置き直させる。
       * 行儀よく書くと、その検査が動いているか永久に分からない。
       */
      phases: fixed
        ? [
          { name: '案出し', goal: '方向の違う案が3つ並んでいる', weeks: 0.5, owner: '企画担当' },
          { name: '仕上げ', goal: '選んだ案が使える形になっている', weeks: 0.5, owner: '開発担当' },
        ]
        : [
          { name: '宣伝の下ごしらえ', goal: '告知の集客プランが決まっている', weeks: 0.5, owner: '執筆担当' },
          { name: '案出し', goal: '方向の違う案が3つ並んでいる', weeks: 0.5, owner: '企画担当' },
          { name: '仕上げ', goal: '選んだ案が使える形になっている', weeks: 0.5, owner: '開発担当' },
        ],
      /**
       * **1回目はわざと辻褄を壊す**（2026-08-26）。関門の行き先が実在しないフェーズを指す。
       * 本物のモデルも、フェーズ名を書き写すときにこれをやる。
       * 行儀よく書くと、`checkPlan` → 引き直しが動いているか**永久に分からない**。
       */
      gates: [{ after_phase: fixed ? '案出し' : '下ごしらえ', question: 'どの案で進めるか' }],
      why: fixed
        ? ['見た目より先に方向を決めます。方向が変わると、仕上げたものは作り直しになるからです。',
           '案は3つに絞ります。2つでは比べられず、5つでは選べません。']
        : [],
      assumes: fixed
        ? [{ label: '使う場面', value: '画面と紙の両方で使う前提にしています' }]
        : [],
      dropped: fixed ? '先に1案だけ作り込む道は見送りました。合わなかったときに戻れません。' : '',
      time_note: fixed ? '半分を案出しに使います。仕上げは選んでからのほうが速いからです。' : '',
      /**
       * **本番で起きたことを、そのまま再現する**（2026-08-25）。
       * 実キーのモデルは `hires: []` を返し、担当には
       * 「商品設計担当」「デザイン制作担当」という**この会社に居ない名前**を書いた。
       * その結果、承認しても誰も採用されず、担当のいないタスクが2本走って失敗した。
       * ここを行儀よく書くと、その穴は検査に**永久に出てこない**。
       */
      first_phase_tasks: [
        { title: '参考を集める', intent: '同じ業種の事例を10件集めて、方向を3つに分ける', owner_hint: '商品設計担当' },
        { title: '案を3つ出す', intent: '方向の違う案を3つ。それぞれ選ぶ理由を1行で', owner_hint: 'デザイン制作担当' },
      ],
      deliverables: [
        { name: '案の比較', phase: '案出し' },
        { name: '仕上がったもの', phase: '仕上げ' },
      ],
    };
  }
  return {
    weeks: 10,
    /**
     * **1回目はわざと2つ壊す**（2026-08-26）。
     * ① 週数を足すと12週で、全体の10週と食い違う（本物のモデルがよく外す）
     * ② **ローンチが「受注が3件入っている」** — 他人が動かないと終わらないフェーズで、
     *    AI社員には終わらせられない。置くと会社がそこで止まる
     *    （社長の「受注が来てから制作っていうようにしたくない」）
     * 行儀よく書くと、`checkPlan` → 引き直しが動いているか永久に分からない。
     */
    phases: [
      { name: '調査', goal: '市場・競合・対象が確かめられている', weeks: 2, owner: '調査担当' },
      { name: '戦略', goal: '収益モデルと価格が決まっている', weeks: 2, owner: '戦略担当' },
      { name: 'プロダクト', goal: 'いちばん小さい形が動いている', weeks: fixed ? 4 : 6, owner: '開発担当' },
      { name: 'ローンチ',
        goal: fixed ? '公開して、申し込みの導線ができている' : '受注が3件入っている',
        weeks: 2, owner: fixed ? '執筆担当' : '営業担当' },
    ],
    gates: [
      { after_phase: '戦略', question: '価格の方向性' },
      { after_phase: 'プロダクト', question: 'MVPの線引き' },
    ],
    first_phase_tasks: [
      { title: '競合を並べて比べる', intent: '競合を5〜8社。価格 / 対象 / 強み / 弱みの4軸で表にする。出典URLを各セルに残す', owner_hint: '調査担当' },
      // **わざと別の人にする**（2026-08-26）。同じ人には2本同時にやらせないので、
      // 担当が分かれて初めて「全員動き出す」が目に見える
      { title: '市場の大きさを出す', intent: '上から（統計）と下から（単価×人数）の2通り。3倍以上ずれたら前提の違いを書く', owner_hint: '分析担当' },
      { title: '対象を1つに絞る', intent: '調査をもとに、誰のどの困りごとに絞るかを1文で', owner_hint: '調査担当' },
    ],
    deliverables: [
      { name: '競合表', phase: '調査' },
      { name: '市場規模の推計', phase: '調査' },
      { name: '対象の定義', phase: '調査' },
      { name: '収益モデル比較', phase: '戦略' },
      { name: '価格表', phase: '戦略' },
      /**
       * **引き直しても、少しだけ残す**（2026-08-26）。
       * 本物のモデルは**言われたところは直すが、言われていないところは残す** —
       * ここではフェーズ名を言い換えている（「プロダクト」を「MVP」と書く）。
       * `deliverable-phase` が拾って `unfixed` に残り、承認画面が
       * 「直しきれなかったところ」として正直に出す。
       * 行儀よく書くと、その道が動いているか永久に分からない。
       */
      { name: 'MVPの要件', phase: fixed ? 'MVP' : 'プロダクト' },
    ],
    /** **理由も本物と同じ形で返す**（2026-08-26）。空で返すと画面が空節を描くかが分からない */
    why: [
      '調査を先に置きます。誰に売るかが決まる前に価格を決めると、あとで全部引き直しになります。',
      '価格はプロダクトより前です。いくらで売るかで、いちばん小さい形の中身が変わります。',
      'ローンチは2週だけにしました。最初の利用者が来てから直すほうが、来る前に直すより速いからです。',
    ],
    assumes: [
      { label: '売り方', value: '自分で売る前提です。代理店を通すなら週数が変わります' },
      { label: '競合の数', value: '比べる相手が5〜8社いる市場だと見ています' },
    ],
    dropped: 'いきなり作り始める道は見送りました。誰に売るかが決まっていないと、作ったものの直し幅が大きくなります。',
    time_note: '10週のうち4週を確かめることに使います。作るのは、決まってからのほうが速いからです。',
  };
}


/**
 * チャット（決め打ち）。**本物と同じ道具**で、話の中身に応じてカードを出す。
 * ここが返すのは考えた結果ではないので、画面は必ず「仮」と名乗る。
 */
async function* fakeChat(input: RunInput): AsyncIterable<Chunk> {
  const said = lastText(input);
  const sys = input.system ?? '';
  const hasWork = sys.includes('もう Work を作りました');

  /**
   * **思い出したものを、そのまま言い返す**（Hermes の cross-session recall。2026-08-26）。
   * 決め打ちのプロバイダは考えないので、**渡されたものを echo するのが唯一の証拠**になる
   * （MCP の「読んだものが成果物に入っている」と同じ確かめ方）。
   * 道具は使わない — 尋ねられたことに答える往復なので、カードで終わらなくていい。
   */
  const memo = sys.match(/会社がすでに知っていること（(.+?)）: (.+)/);
  if (memo && /どうなって|どうだった|思い出|何だっけ|なんだっけ/.test(said)) {
    yield { type: 'text', text: `（仮の返事）思い出しました — ${memo[1]}「${memo[2]}」があります。` };
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'end_turn' };
    return;
  }

  // ① すでに事業がある道 — 材料が来たら覚え、そろったら診断
  const url = said.match(/([\w-]+(?:\.[\w-]+)+(?:\/\S*)?)/)?.[1];
  const numbers = /[0-9０-９][\d,，]{2,}/.test(said);
  // 材料をもらう前は、道具が要らない（ふつうの返事だけ）
  if (/すでに事業|いまの事業|事業があります/.test(said)) {
    yield { type: 'text', text: '（仮の返事）いまの事業のことを教えてください。サイトのURL、資料、売上の数字 — あるものだけで構いません。' };
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'end_turn' };
    return;
  }
  if (url || numbers) {
    if (url) yield tool('remember_material', { kind: 'site', locator: url });
    if (numbers) yield tool('remember_material', { kind: 'doc', locator: '書いて渡した', content: said });
    const enough = sys.includes('取り込んだ材料:');
    if (enough || (url && numbers)) {
      yield tool('describe_business', { name: (url ?? 'わたしの事業').replace(/^https?:\/\//, '').split('/')[0], stage: '立ち上げ期' });
      const sales = said.match(/売上[^0-9]{0,6}([\d,]{3,})/)?.[1];
      yield tool('report_facts', { facts: [
        sales ? { label: '月の売上', value: `¥${sales}`, note: '書いて渡した から' }
              : { label: '月の売上', value: '—', note: '読み取れていません', missing: true },
        { label: '継続率', value: '—', note: '測れていません', missing: true },
      ] });
      yield tool('report_diagnosis', { findings: [
        { severity: '重い', title: '継続率を測れていない',
          why: '解約がいつ・なぜ起きたかの記録が、渡された材料のどこにも無い。',
          evidence: [`${url ?? '書いて渡した'} に解約・継続の記録が無い`],
          work: { title: '継続率を見えるようにする', goal: '誰がいつ辞めたかが毎月1枚で分かる', weeks: 3 } },
        { severity: '中くらい', title: '申込までの導線が測れていない',
          why: '来訪から申込までのどこで落ちているかが数字で追えない。',
          evidence: [`${url ?? '書いて渡した'} に計測の記述が無い`],
          work: { title: '申込導線の計測と改善', goal: '落ちる場所が数字で分かり、1つ直せている', weeks: 4 } },
      ] });
    }
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
    return;
  }

  /**
   * **「どれも違う」と言われた往復。** すぐ3つ出し直さない —
   * 何が違うかを1問だけ聞いてから、違う軸で出し直す（本物の方針と同じ形）。
   */
  if (/ピンと来|どれも違/.test(said)) {
    yield tool('ask', { questions: [{
      body: 'どこが違いますか。',
      why: '違う軸で出し直すために、いちばん外したいところを教えてください。',
      options: [
        { label: '相手が違う', description: '誰に売るかを変えます', recommended: true },
        { label: '売り方が違う', description: '講座・教材・受託のような形を変えます' },
        { label: '分野そのものが違う', description: '別の分野から考え直します' },
      ],
    }] });
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
    return;
  }

  /**
   * **「どこが違うか」に答えた往復。** ここで Work を提案してはいけない
   * （答えは答えであって、新しいゴールではない）。**違う軸で候補を出し直す。**
   */
  if (/どこが違いますか/.test(said)) {
    const cur0 = (() => {
      try { return JSON.parse(input.system?.match(/集まっている条件:\n(\{[\s\S]*?\})/)?.[1] ?? '{}'); }
      catch { return {}; }
    })();
    const axis = said.includes('相手が違う') ? '相手を変えて'
      : said.includes('売り方が違う') ? '売り方を変えて' : '分野から見直して';
    yield tool('propose_candidates', {
      candidates: fakeCands(cur0).map((c) => ({ ...c, summary: `（${axis}）${c.summary}` })),
    });
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
    return;
  }

  // ② まだ決まっていない道 — 条件を集めて、そろったら候補
  const cond = condFrom(said);
  const already = sys.match(/集まっている条件:\n(\{[\s\S]*?\})/)?.[1];
  let cur: Record<string, unknown> = {};
  try { cur = JSON.parse(already ?? '{}'); } catch { /* 空のまま */ }

  if (/まだ決まって|決まっていません/.test(said) && !Object.keys(cond).length) {
    yield tool('ask', { questions: askSet(cur) });
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
    return;
  }
  /**
   * 条件が読み取れた往復は**書くだけで止まる** — 本物のモデルが実際そうだった
   * （条件を写して満足し、候補が出ない）。その形をここでも通すので、
   * **続きの仕掛け**（→ `lib/exec/reply.ts`）が必ず検査に載る。
   */
  if (Object.keys(cond).length) {
    yield tool('set_conditions', cond);
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
    return;
  }

  // ③ やりたいことがある道 — まとまったら Work を提案（もう作っていれば提案しない）
  if (!hasWork && said.length >= 6 && !said.endsWith('？') && !said.endsWith('?')) {
    yield tool('propose_work', {
      title: title(said), goal: said.replace(/。$/, ''), weeks: 10,
      why: '終わりが言えて、単独で価値があるので Work にできます。',
    });
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
    return;
  }

  yield { type: 'text', text: `（仮の返事）「${said.slice(0, 30)}」を受け取りました。この環境には鍵が無いので、本当の返事は出せません。` };
  yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'end_turn' };
}

/**
 * 道具なしの往復（＝本文だけ書く2度め）の返事。
 *
 * **本物のモデルは、道具を呼ぶ往復では本文を書かない。**
 * `chatStep` はそれを見て「本文だけもう一度」頼み直す。ここはその2度めに答える —
 * 前置きに書かれた**いま画面に出るカード**を読んで、それに添う一言を返す。
 */
function chatWords(input: RunInput, goal: string): string {
  /**
   * **思い出したものを、そのまま言い返す**（Hermes の cross-session recall。2026-08-26）。
   * 決め打ちのプロバイダは考えないので、**渡されたものを echo するのが唯一の証拠**になる
   * （MCP の「読んだものが成果物に入っている」と同じ確かめ方）。
   */
  const memo = (input.system ?? '').match(/会社がすでに知っていること（(.+?)）: (.+)/);
  if (memo) return `思い出しました — ${memo[1]}「${memo[2]}」があります。`;
  const cards = (input.system ?? '').match(/社長の画面には次が出ます:\n([\s\S]*?)\n\n/)?.[1] ?? '';
  if (cards.includes('聞きたいこと')) return '先に条件だけ教えてください。全部でなくて構いません。2つそろったら、候補を3つ出します。';
  if (cards.includes('条件に合う道')) return '条件に合う道を3つ出しました。いちばん上をおすすめします。';
  if (cards.includes('診断')) return '材料がそろったので、診断しました。重いものから見てください。';
  if (cards.includes('Work の提案')) return '内容を Work にできます。終わりが言えて、単独で価値があり、3ヶ月に収まります。';
  if (cards.includes('覚えた材料')) return '受け取りました。数字か、サイトのURLがもう1つあると診断できます。';
  if (cards.includes('条件')) return '受け取りました。もう1つ条件をもらえると、候補を出せます。';
  return `「${goal.slice(0, 40)}」を受け取りました。この環境には鍵が無いので、本当の返事は出せません。`;
}

/** 言われたことから条件を拾う（チャットと Case B で同じ読み方をする） */
function condFrom(said: string): Record<string, unknown> {
  const put: Record<string, unknown> = {};
  // 語尾（です・ます）まで拾うと「日本語教育です」が得意になる。落としてから使う
  const words = (s: string) => s.split(/[・、,\sと]+/)
    .map((x) => x.trim().replace(/(です|でした|ます|だった|なんです)$/, ''))
    .filter(Boolean).slice(0, 3);
  const hours = said.match(/週\s*〜?~?(\d+)\s*時間/)?.[1];
  if (hours) put.hours_per_week = Number(hours);
  const man = said.match(/〜?~?(\d+)\s*万円/)?.[1];
  if (man) put.budget_jpy = Number(man) * 10000;
  const strong = said.match(/(?:得意|強み)[はがの: ：]*\s*([^\n。．]+)/)?.[1];
  if (strong) put.strengths = words(strong);
  const field = said.match(/(?:分野|業種|興味)[はがの: ：]*\s*([^\n。．]+)/)?.[1];
  if (field) put.interests = words(field);
  /**
   * 板は**最後まで答えてから1通で送る**ので、「質問 → 答え」が何行も来る。
   * 1行目だけ見ると、2問目の答えを落とす。
   */
  const arrows = [...said.matchAll(/^(.+?)\s*→\s*(.+)$/gm)];
  if (arrows.length) {
    for (const [, ask, ans] of arrows) {
      if (/やりたくない|避けたい/.test(ask)) put.avoid = [ans.trim()];
      if (/得意|強み/.test(ask)) put.strengths = words(ans);
      // **分野。** これが無いと、何に関する案なのか分からない
      if (/分野|業種|興味/.test(ask)) put.interests = [ans.trim()];   // 分野は割らない（「学び・教える」で1つ）
    }
  } else {
    const no = said.match(/(?:やりたくない|避けたい)(?:こと)?[はの: ：]*\s*([^\n。．]+)/)?.[1];
    if (no) put.avoid = words(no);
  }
  return put;
}


/** 前置きの「集まっている条件」を読む（fakeChat と絞られた往復で同じ読み方） */
function readCur(sys: string): Record<string, unknown> {
  const raw = sys.match(/集まっている条件:\n(\{[\s\S]*?\})/)?.[1];
  try { return JSON.parse(raw ?? '{}'); } catch { return {}; }
}

/**
 * 探索の質問（決め打ち）。**やさしいものから、知らないものだけ**聞く。
 * 分野は**最後**で、選択肢は「よくある例」— 本命は自由入力
 * （分野は無数にあるので、一覧から選ばせる形にしない → GUIDE と同じ方針）。
 */
function askSet(cur: Record<string, unknown>) {
  const qs = [];
  if (cur.hours_per_week == null) {
    qs.push({
      body: '週にどれくらい使えますか。',
      why: '使える時間で、選べる道がだいぶ変わります。',
      options: [
        { label: '週5時間まで', description: '本業のすきま。小さく始める案になります', recommended: true },
        { label: '週10時間', description: '平日夜と週末。ふつうの立ち上げができます' },
        { label: '週20時間以上', description: 'ほぼ専念。重い案も選べます' },
      ],
    });
  }
  if (!Array.isArray(cur.avoid) || !cur.avoid.length) {
    qs.push({
      body: 'やりたくないことはありますか。',
      why: '外す条件が1つあると、候補の幅がぐっと絞れます。',
      options: [
        { label: '在庫を持つ', description: '仕入れと保管が要る案を外します', recommended: true },
        { label: '人前に出る', description: '営業や撮影が要る案を外します' },
        { label: '夜間の対応', description: '時差のある顧客を外します' },
      ],
    });
  }
  if (!Array.isArray(cur.interests) || !cur.interests.length) {
    qs.push({
      body: '興味のある分野はありますか。近いものが無ければ、自分の言葉で書いてください。',
      why: '何に関する仕事かが決まると、案が具体的になります。',
      options: [
        { label: '学び・教える', description: '講座・教材・練習の道具など', recommended: true },
        { label: '食・飲食', description: 'お店の手伝い、レシピ、食まわりの道具' },
        { label: '仕事の道具', description: 'テンプレート、業務の型、小さな仕組み' },
      ],
    });
  }
  // ぜんぶ知っているのに聞けと言われた（起きないはずだが、空の板を出さない）
  if (!qs.length) {
    qs.push({
      body: 'ほかに、決めておきたいことはありますか。',
      why: '無ければ、このまま候補を出します。',
      options: [
        { label: '特にない', description: 'このまま候補を出してもらう', recommended: true },
        { label: 'いつまでにやるか', description: '期限を決めてから選ぶ' },
      ],
    });
  }
  return qs;
}

/** 候補3つ（チャットと Case B で同じものを返す） */
function fakeCands(merged: Record<string, unknown>) {
  const strong = (merged.strengths as string[] | undefined)?.[0];
  /**
   * **分野を名前に入れる。** 分野が無いと「オンライン講座」のように
   * 何に関する事業か分からない名前になる（本物でも同じことが起きた）。
   */
  const field = (merged.interests as string[] | undefined)?.[0] ?? '';
  const of = field ? `${field}の` : strong ? `${strong}の` : '';
  const hours = merged.hours_per_week ?? 10;
  const avoid = merged.avoid as string[] | undefined;
  const edge = strong ? `${strong}の経験がそのまま差になります。` : '小さく始めて、続けながら形にできます。';
  /**
   * **軸は 需要 / 1人で回せる / 最初の1件まで**（2026-08-26）。
   * `who` と `first_one` を必ず持たせる — 本物にもそれを required で書かせているので、
   * **決め打ちが空のままだと、画面が空でも検査は通ってしまう**。
   * `unsure` も必ず書く（統括AIは Web を見ていない、という正直さの印）。
   */
  return [
    { name: `${of}オンライン講座`.slice(0, 24),
      summary: `${edge}在庫を持たず、週${hours}時間から始められます。`,
      ending: '最初の受講者が1人、最後まで受け終わっている',
      who: `${field || 'その分野'}を独学ではじめて、途中で止まっている社会人`,
      first_one: `${field || 'その分野'}の学習者が集まっている掲示板とSNSで、3人に直接声をかける`,
      unsure: '独学で止まった人が、お金を払ってでも再開したいのかは確かめていません',
      hours_per_week: Math.min(Number(hours) || 10, 10),
      why: [strong ? `${strong}の経験が、そのまま他社との差になります` : '小さく始められて、途中でやめても損が小さい',
            '在庫を持たないので、外したときの損が小さい',
            '週の時間内で、最初の形まで2ヶ月の見込み'],
      fit: { demand: 78, solo: 92, speed: 86 }, recommended: true },
    { name: `${of}教材販売`.slice(0, 24),
      summary: '作れば売れ続けますが、最初の1本を作り切るまでが長い。',
      ending: '教材が1本できて、販売ページで買える状態になっている',
      who: `${field || 'その分野'}を独学したいが、何から手を付けるか分からない人`,
      first_one: '同じ教材を探している人が集まる場所に、目次だけ先に出して反応を見る',
      unsure: '既にある無料の教材で足りてしまうかどうかは確かめていません',
      hours_per_week: Math.min(Number(hours) || 10, 8),
      why: [], fit: { demand: 55, solo: 88, speed: 42 }, recommended: false,
      not_chosen_why: '最初の1本が長く、途中で判断材料が出ない' },
    { name: `企業むけ ${of}研修`.slice(0, 24),
      summary: '単価は高いが、営業に人前へ出る時間が要ります。',
      ending: '1社で研修を1回やり終えて、次の相談が来ている',
      who: `社員の${field || 'その分野'}の力を上げたい、社員30〜100人の会社の人事`,
      first_one: '知り合いの会社1社に、無料で1回やらせてもらえないか頼む',
      unsure: '決裁が下りる予算枠があるかは確かめていません',
      hours_per_week: 20,
      why: [], fit: { demand: 71, solo: 38, speed: 64 }, recommended: false,
      not_chosen_why: avoid?.length ? `「${avoid[0]}」を外したいという条件に合わない` : '営業に人前へ出る時間が、使える時間に収まらない' },
  ];
}

/**
 * 入口 Case B（決め打ち）。**本物と同じ道具・同じ順**で返す —
 * set_conditions で構造に写し、条件が2つ未満なら ask、そろっていれば propose_candidates。
 * 言われたことの読み取りは素朴な正規表現（考えていない。だから画面に「仮」と出る）。
 */
async function* fakeDiscover(input: RunInput): AsyncIterable<Chunk> {
  const text = lastText(input);
  const said = text.match(/社長が言ったこと:\n([\s\S]*?)(?:\n\n|$)/)?.[1]?.trim() ?? '';
  const force = text.includes('もう候補を出して');
  let cur: Record<string, unknown> = {};
  try { cur = JSON.parse(text.match(/いまの条件（構造）:\n(\{[\s\S]*?\})\n\n/)?.[1] ?? '{}'); } catch { /* 空のまま */ }

  // 言われたことを構造に写す（分かった項目だけ）
  const put: Record<string, unknown> = {};
  const hours = said.match(/週\s*〜?~?(\d+)\s*時間/)?.[1];
  if (hours) put.hours_per_week = Number(hours);
  const man = said.match(/〜?~?(\d+)\s*万円/)?.[1];
  if (man) put.budget_jpy = Number(man) * 10000;
  // **文の終わりで止める。** `[^\n]+` だと次の文まで飲み込んで、
  // 「得意 = 日本語教育と韓国語。元手は50万円まで。」が条件になる（実際そうなった）
  const words = (s: string) => s.split(/[・、,\sと]+/).map((x) => x.trim()).filter(Boolean).slice(0, 3);
  const strong = said.match(/(?:得意|強み)[はがの: ：]*\s*([^\n。．]+)/)?.[1];
  if (strong) put.strengths = words(strong);
  const field = said.match(/(?:分野|業種|興味)[はがの: ：]*\s*([^\n。．]+)/)?.[1];
  if (field) put.interests = words(field);
  // 板からの答えは「質問 → 答え」の形で来る。質問文を条件に混ぜない
  const arrow = said.match(/(.+?)\s*→\s*(.+)/);
  if (arrow && /やりたくない/.test(arrow[1])) {
    put.avoid = [arrow[2].trim()];
  } else if (!arrow) {
    const no = said.match(/(?:やりたくない|避けたい)(?:こと)?[はの: ：]*\s*([^\n。．]+)/)?.[1];
    if (no) put.avoid = words(no);
  }
  if (Object.keys(put).length) yield tool('set_conditions', put);

  const merged = { ...cur, ...put } as {
    hours_per_week?: number; budget_jpy?: number; strengths?: string[]; avoid?: string[]; deadline?: string;
  };
  const filled =
    Number(merged.hours_per_week != null) + Number(merged.budget_jpy != null)
    + Number(!!merged.strengths?.length) + Number(!!merged.avoid?.length) + Number(!!merged.deadline);

  if (!force && filled < 2) {
    yield tool('ask', { questions: [{
      body: 'やりたくないことはありますか。',
      why: '外す条件が1つあると、候補の幅がぐっと絞れます。',
      options: [
        { label: '在庫を持つ', description: '仕入れと保管が要る案を外します', recommended: true },
        { label: '人前に出る', description: '営業や撮影が要る案を外します' },
        { label: '夜間の対応', description: '時差のある顧客を外します' },
      ],
    }] });
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
    return;
  }

  const s = merged.strengths?.[0] ?? '得意なこと';
  yield tool('propose_candidates', { candidates: [
    {
      name: `${s}のオンライン講座`.slice(0, 20),
      summary: `${s}の経験がそのまま差になります。在庫を持たず、週${merged.hours_per_week ?? 10}時間から始められます。`,
      why: [
        `${s}の経験が、そのまま他社との差になります`,
        '在庫を持たないので、外したときの損が小さい',
        '週の時間内で、最初の形まで2ヶ月の見込み',
      ],
      fit: { speed: 86, cost: 92, strength: 94 }, recommended: true,
    },
    {
      name: `${s}の教材販売`.slice(0, 20),
      summary: '作れば売れ続けますが、最初の1本を作り切るまでが長い。',
      why: [], fit: { speed: 42, cost: 88, strength: 70 }, recommended: false,
      not_chosen_why: '最初の1本が長く、途中で判断材料が出ない',
    },
    {
      name: `企業むけ ${s}研修`.slice(0, 20),
      summary: '単価は高いが、営業に人前へ出る時間が要ります。',
      why: [], fit: { speed: 64, cost: 76, strength: 48 }, recommended: false,
      not_chosen_why: merged.avoid?.length ? `「${merged.avoid[0]}」を外したいという条件に合わない` : '営業の時間が条件に合わない',
    },
  ] });
  yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
}

/**
 * 入口 Case D（決め打ち）。材料の名前を根拠に挙げ、
 * **測れていない数字は missing で出す**（本物に求めるのと同じ正直さ）。
 */
async function* fakeDiagnose(input: RunInput): AsyncIterable<Chunk> {
  const text = lastText(input);
  const locators = [...text.matchAll(/### 材料\d+ — (.+?)（/g)].map((m) => m[1]);
  const first = locators[0] ?? '取り込んだもの';
  const site = locators.find((l) => /^https?:\/\//.test(l) || /\./.test(l));

  const name = site
    ? site.replace(/^https?:\/\//, '').replace(/\/.*$/, '').slice(0, 20)
    : 'わたしの事業';
  yield tool('describe_business', { name, stage: '立ち上げ期' });

  const sales = text.match(/売上[^0-9]{0,6}([\d,]{3,})/)?.[1];
  const price = text.match(/(?:価格|単価|1回)[^0-9]{0,6}¥?([\d,]{3,})/)?.[1];
  yield tool('report_facts', { facts: [
    sales
      ? { label: '月の売上', value: `¥${sales}`, note: `${first} から` }
      : { label: '月の売上', value: '—', note: '読み取れていません', missing: true },
    price
      ? { label: '価格', value: `¥${price}`, note: `${first} から` }
      : { label: '価格', value: '—', note: '読み取れていません', missing: true },
    { label: '継続率', value: '—', note: '測れていません', missing: true },
  ] });

  yield tool('report_diagnosis', { findings: [
    {
      severity: '重い', title: '継続率を測れていない',
      why: '解約がいつ・なぜ起きたかの記録が、渡された材料のどこにも無い。',
      evidence: [`${first} に解約・継続の記録が無い`],
      work: { title: '継続率を見えるようにする', goal: '誰がいつ辞めたかが毎月1枚で分かる', weeks: 3 },
    },
    {
      severity: '中くらい', title: '申込までの導線が測れていない',
      why: '来訪から申込までのどこで落ちているかが数字で追えない。',
      evidence: locators.length > 1 ? [`${locators[1]} に計測の記述が無い`] : [`${first} に計測の記述が無い`],
      work: { title: '申込導線の計測と改善', goal: '来訪→申込の落ちる場所が数字で分かり、1つ直せている', weeks: 4 },
    },
  ] });
  yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
}

/** 次のフェーズのタスク（決め打ち）。フェーズ名で中身を変える */
function nextTasks(phase: string) {
  if (/戦略/.test(phase)) {
    return [
      { title: '収益モデルを比べる', intent: '売切り / 月額 / 回数券の3案。継続率の前提つきで損益を並べる', owner_hint: '戦略担当',
        /**
         * **調査を読んで、社長にしか決められないと分かったこと**（2026-08-26。社長の
         * 「わからない部分は統括AIがユーザーに質問投げて他のAIが全員動き出す」）。
         * このタスクだけが待ち、**ほかのタスクは動き出す**。
         */
        ask: {
          question: '収益の取り方',
          why: '調査では、月額と売切りのどちらが合うかまでは決まりませんでした。ここは社長の判断です。',
          options: [
            { label: '月額', description: '毎月入るが、続けてもらう手間がかかる', recommended: true },
            { label: '売切り', description: '一度で入るが、次を探し続けることになる' },
            { label: '両方', description: '選べるようにする。作るものが増える' },
          ],
        } },
      { title: '価格の帯を決める', intent: '競合表の価格帯に、決めた対象の支払い意欲を重ねて2案に絞る', owner_hint: '戦略担当' },
      // **図の道も通す**（draw_workflow → 9つの検査 → 描き直し）。
      // 決め打ちでも本物と同じ道具・同じ順を踏まないと、この穴は見つからない
      { title: '申込の流れを描く', intent: '申し込みから受け取りまでの流れを図にする。差し戻しの道も入れる', owner_hint: '企画担当' },
    ];
  }
  if (/プロダクト|MVP/.test(phase)) {
    return [
      { title: 'MVPの要件を書く', intent: '作らないものを先に決めてから、受け入れ条件つきで要件に落とす', owner_hint: '企画担当' },
      { title: 'LPの構成を書く', intent: '見出し・価格表・申込みの3節。決めた価格と対象に沿う', owner_hint: '企画担当' },
    ];
  }
  return [
    // **担当は必ず書く**（本物も required。書かないと先頭の社員に落ちる、を作らない）
    { title: `${phase || '次'}の段取りを引く`, intent: 'このフェーズでやることを3件に分けて、順番を決める',
      owner_hint: '企画担当' },
  ];
}

/**
 * 決め打ちの図（archify の形）。**1回目はわざと壊す** — 線の先に居ないノードを指す。
 * OneFound の9つの検査がそれを見つけ、道具を1つに絞って描き直しを頼み、
 * 2回目（`fixing`）で通る形になる。
 */
function wfDraw(fixing: boolean) {
  return {
    title: '申込の流れ',
    subtitle: '申し込みから受け取りまで',
    lanes: [
      { id: 'you', label: 'あなた' },
      { id: 'ai', label: 'AI社員' },
    ],
    phases: [
      { id: 'p1', label: '受付', fromCol: 0, toCol: 1 },
      { id: 'p2', label: '制作', fromCol: 2, toCol: 4 },
    ],
    nodes: [
      { id: 'apply', lane: 'you', col: 0, type: 'work', label: '申し込みを受ける' },
      { id: 'check', lane: 'ai', col: 1, type: 'work', label: '内容を確かめる', sublabel: '不足は差し戻す' },
      { id: 'decide', lane: 'you', col: 2, type: 'decision', label: '受けるか決める' },
      { id: 'make', lane: 'ai', col: 3, type: 'work', label: '作って渡す' },
      { id: 'done', lane: 'you', col: 4, type: 'end', label: '受け取ってもらう' },
    ],
    edges: [
      { from: 'apply', to: 'check', role: 'main' },
      { from: 'check', to: 'decide', role: 'main' },
      { from: 'decide', to: 'make', label: '受ける', role: 'main' },
      { from: 'make', to: 'done', role: 'main' },
      // **ここが壊れているところ** — `resend` は居ない。直すと 'apply' へ戻る
      { from: 'check', to: fixing ? 'apply' : 'resend', label: '不足あり', role: 'return' },
    ],
    mainPath: ['apply', 'check', 'decide', 'make', 'done'],
  };
}
