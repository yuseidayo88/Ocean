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
    const goal = lastUser(input);
    const want = new Set((input.tools ?? []).map((t) => t.name));

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

    if (want.has('decide_container')) {
      yield tool('decide_container', container(goal));
    }
    if (want.has('ask')) {
      yield tool('ask', { questions: questions(goal) });
    }
    if (want.has('propose_hires')) {
      yield tool('propose_hires', { hires: hires(goal) });
    }
    if (want.has('draft_plan')) {
      yield tool('draft_plan', plan(goal));
    }
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
  }
}

let n = 0;
const tool = (name: string, inputValue: unknown): Chunk =>
  ({ type: 'tool_use', id: `fake-${++n}`, name, input: inputValue });

/**
 * AI社員の1タスク（決め打ち）。**本物と同じ4道具・同じ順**で返すので、
 * runner のパース・DB書き込み・通知・進捗導出の穴はこれで見つかる。
 * 歩みのあいだに少し待つ — 画面のポーリングが「流れて見える」ことまで確かめられる。
 */
async function* fakeRun(input: RunInput): AsyncIterable<Chunk> {
  const text = lastText(input);
  const task = text.match(/あなたのタスク: (.+)/)?.[1]?.trim() ?? '作業';
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    title: task.slice(0, 18), kind: 'report',
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
    { definition_id: 'revenue-strategist', display_name: '戦略担当',
      why: 'いくらで売るかを決める人がいません。', for_phase: '戦略' },
  ];
}

function plan(goal: string) {
  if (SHORT_ONE.test(goal)) {
    return {
      weeks: 1,
      phases: [
        { name: '案出し', goal: '方向の違う案が3つ並んでいる', weeks: 0.5 },
        { name: '仕上げ', goal: '選んだ案が使える形になっている', weeks: 0.5 },
      ],
      gates: [{ after_phase: '案出し', question: 'どの案で進めるか' }],
      first_phase_tasks: [
        { title: '参考を集める', intent: '同じ業種の事例を10件集めて、方向を3つに分ける', owner_hint: '調査担当' },
        { title: '案を3つ出す', intent: '方向の違う案を3つ。それぞれ選ぶ理由を1行で', owner_hint: '企画担当' },
      ],
      deliverables: ['案の比較', '仕上がったもの'],
    };
  }
  return {
    weeks: 10,
    phases: [
      { name: '調査', goal: '市場・競合・対象が確かめられている', weeks: 2 },
      { name: '戦略', goal: '収益モデルと価格が決まっている', weeks: 2 },
      { name: 'プロダクト', goal: 'いちばん小さい形が動いている', weeks: 4 },
      { name: 'ローンチ', goal: '最初の利用者が来ている', weeks: 2 },
    ],
    gates: [
      { after_phase: '戦略', question: '価格の方向性' },
      { after_phase: 'プロダクト', question: 'MVPの線引き' },
    ],
    first_phase_tasks: [
      { title: '競合を並べて比べる', intent: '競合を5〜8社。価格 / 対象 / 強み / 弱みの4軸で表にする。出典URLを各セルに残す', owner_hint: '調査担当' },
      { title: '市場の大きさを出す', intent: '上から（統計）と下から（単価×人数）の2通り。3倍以上ずれたら前提の違いを書く', owner_hint: '調査担当' },
      { title: '対象を1つに絞る', intent: '調査をもとに、誰のどの困りごとに絞るかを1文で', owner_hint: '調査担当' },
    ],
    deliverables: ['競合表', '市場規模の推計', '対象の定義', '収益モデル比較', '価格表', 'MVPの要件'],
  };
}


/** 次のフェーズのタスク（決め打ち）。フェーズ名で中身を変える */
function nextTasks(phase: string) {
  if (/戦略/.test(phase)) {
    return [
      { title: '収益モデルを比べる', intent: '売切り / 月額 / 回数券の3案。継続率の前提つきで損益を並べる', owner_hint: '戦略担当' },
      { title: '価格の帯を決める', intent: '競合表の価格帯に、決めた対象の支払い意欲を重ねて2案に絞る', owner_hint: '戦略担当' },
    ];
  }
  if (/プロダクト|MVP/.test(phase)) {
    return [
      { title: 'MVPの要件を書く', intent: '作らないものを先に決めてから、受け入れ条件つきで要件に落とす', owner_hint: '企画担当' },
      { title: 'LPの構成を書く', intent: '見出し・価格表・申込みの3節。決めた価格と対象に沿う', owner_hint: '企画担当' },
    ];
  }
  return [
    { title: `${phase || '次'}の段取りを引く`, intent: 'このフェーズでやることを3件に分けて、順番を決める' },
  ];
}