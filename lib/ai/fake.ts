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

    // ══ 道具なし＝会話（チャットの返事）══ 偽物であることを必ず言う
    if (!input.tools?.length) {
      yield { type: 'text', text: `（仮の返事）「${goal.slice(0, 40)}」を受け取りました。この環境には鍵が無いので、本当の返事は出せません。` };
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


/**
 * チャット（決め打ち）。**本物と同じ道具**で、話の中身に応じてカードを出す。
 * ここが返すのは考えた結果ではないので、画面は必ず「仮」と名乗る。
 */
async function* fakeChat(input: RunInput): AsyncIterable<Chunk> {
  const said = lastText(input);
  const sys = input.system ?? '';
  const hasWork = sys.includes('もう Work を作りました');

  // ① すでに事業がある道 — 材料が来たら覚え、そろったら診断
  const url = said.match(/([\w-]+(?:\.[\w-]+)+(?:\/\S*)?)/)?.[1];
  const numbers = /[0-9０-９][\d,，]{2,}/.test(said);
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
      yield { type: 'text', text: '（仮の返事）材料がそろったので、診断しました。' };
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
    } else {
      yield { type: 'text', text: '（仮の返事）受け取りました。ほかにも materials があれば教えてください。数字か、サイトのURLがあると診断できます。' };
    }
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
    return;
  }

  // ② まだ決まっていない道 — 条件を集めて、2つそろったら候補
  const cond = condFrom(said);
  const already = sys.match(/集まっている条件:\n(\{[\s\S]*?\})/)?.[1];
  let cur: Record<string, unknown> = {};
  try { cur = JSON.parse(already ?? '{}'); } catch { /* 空のまま */ }
  if (/まだ決まって|決まっていません/.test(said) && !Object.keys(cond).length) {
    yield { type: 'text', text: '（仮の返事）先に条件だけ教えてください。全部でなくて構いません。2つそろったら、候補を3つ出します。' };
    yield tool('ask', { questions: [{
      body: '週にどれくらい使えますか。',
      why: '使える時間で、選べる道がだいぶ変わります。',
      options: [
        { label: '週5時間まで', description: '本業のすきま。小さく始める案になります', recommended: true },
        { label: '週10時間', description: '平日夜と週末。ふつうの立ち上げができます' },
        { label: '週20時間以上', description: 'ほぼ専念。重い案も選べます' },
      ],
    }] });
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
    return;
  }
  if (Object.keys(cond).length) {
    yield tool('set_conditions', cond);
    const merged = { ...cur, ...cond } as Record<string, unknown>;
    const filled = ['hours_per_week', 'budget_jpy', 'strengths', 'avoid', 'deadline']
      .filter((k) => merged[k] != null && (!Array.isArray(merged[k]) || (merged[k] as unknown[]).length)).length;
    if (filled >= 2) {
      yield { type: 'text', text: '（仮の返事）条件に合う道を3つ出しました。いちばん上をおすすめします。' };
      yield tool('propose_candidates', { candidates: fakeCands(merged) });
    } else {
      yield { type: 'text', text: '（仮の返事）受け取りました。もう1つ条件をもらえると、候補を出せます。' };
    }
    yield { type: 'done', usage: EMPTY_USAGE, stopReason: 'tool_use' };
    return;
  }

  // ③ やりたいことがある道 — まとまったら Work を提案（もう作っていれば提案しない）
  if (!hasWork && said.length >= 6 && !said.endsWith('？') && !said.endsWith('?')) {
    yield { type: 'text', text: '（仮の返事）内容を Work にできます。終わりが言えて、単独で価値があり、3ヶ月に収まります。' };
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
  const arrow = said.match(/(.+?)\s*→\s*(.+)/);
  if (arrow && /やりたくない/.test(arrow[1])) put.avoid = [arrow[2].trim()];
  else if (!arrow) {
    const no = said.match(/(?:やりたくない|避けたい)(?:こと)?[はの: ：]*\s*([^\n。．]+)/)?.[1];
    if (no) put.avoid = words(no);
  }
  return put;
}

/** 候補3つ（チャットと Case B で同じものを返す） */
function fakeCands(merged: Record<string, unknown>) {
  const s = (merged.strengths as string[] | undefined)?.[0] ?? '得意なこと';
  const hours = merged.hours_per_week ?? 10;
  const avoid = merged.avoid as string[] | undefined;
  return [
    { name: `${s}のオンライン講座`.slice(0, 20),
      summary: `${s}の経験がそのまま差になります。在庫を持たず、週${hours}時間から始められます。`,
      why: [`${s}の経験が、そのまま他社との差になります`,
            '在庫を持たないので、外したときの損が小さい',
            '週の時間内で、最初の形まで2ヶ月の見込み'],
      fit: { speed: 86, cost: 92, strength: 94 }, recommended: true },
    { name: `${s}の教材販売`.slice(0, 20),
      summary: '作れば売れ続けますが、最初の1本を作り切るまでが長い。',
      why: [], fit: { speed: 42, cost: 88, strength: 70 }, recommended: false,
      not_chosen_why: '最初の1本が長く、途中で判断材料が出ない' },
    { name: `企業むけ ${s}研修`.slice(0, 20),
      summary: '単価は高いが、営業に人前へ出る時間が要ります。',
      why: [], fit: { speed: 64, cost: 76, strength: 48 }, recommended: false,
      not_chosen_why: avoid?.length ? `「${avoid[0]}」を外したいという条件に合わない` : '営業の時間が条件に合わない' },
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