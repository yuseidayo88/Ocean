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
 * ゴールだけ取り出す。**プロンプト全文を読まない** —
 * 全文から題名を作ると「道具を順に呼んでください」まで題名に入る（実際そうなった）。
 */
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
