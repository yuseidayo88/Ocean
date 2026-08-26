import type { ModelProvider, Msg } from '@/lib/ai';
import { hasKey, labelFor, providerFor } from '@/lib/ai';
import { FakeProvider } from '@/lib/ai/fake';
import { AppError } from '@/lib/errors';
import { CONSTITUTION } from './constitution';
import { ask } from './tools';
import { proposeWork, rememberMaterial } from './chat-tools';
import { describeBusiness, proposeCandidates, reportDiagnosis, reportFacts, setConditions } from './entry-tools';
import { checkStop, finite, score, toQuestions } from './parse';
import type { CandidateDraft, Conditions, Fact, Finding, Question } from './types';

/**
 * チャットの1往復。**入口も相談も、ぜんぶここで起きる**（2026-08-24 の作り直し）。
 *
 * Phase 5（`run.ts`）と違うところ:
 *   ・**文章が主役。** 道具が1つも来ない往復（ただの返事）も正しい
 *   ・道具は返事に添える**カード**を作るためのもの
 *   ・**Work は勝手に作らない。** `propose_work` で提案し、社長が押してから作る
 *
 * 速さを優先して `fast`（＝いちばん浅い thinking）で回す。
 * 3階層とも同じモデルなので、違うのは考える量だけ（→ `lib/ai/tiers.ts`）。
 */

export type ChatOut = {
  real: boolean;
  /** 統括AIの返事（本文）。空のこともある */
  text: string;
  /** 聞きたいこと（カードになる） */
  questions: Question[];
  /** 条件の差分（言われた項目だけ） */
  conditions: Partial<Conditions>;
  /** 候補3つ（出たときだけ） */
  candidates: CandidateDraft[];
  /** 覚える材料 */
  materials: { kind: 'site' | 'doc' | 'sheet'; locator: string; content?: string }[];
  /** 事業の名前・段階 */
  business?: { name?: string; stage?: string };
  facts: Fact[];
  findings: Finding[];
  /** Work の提案（社長が押したら作る） */
  work?: { title: string; goal: string; weeks: number; why: string };
};

/** いまのスレッドの状態。プロンプトに畳んで渡す */
export type ChatState = {
  /** もう Work を作ったか（1チャット=1Work） */
  hasWork: boolean;
  /** 集まっている条件（まだ決まっていない人の道） */
  conditions?: Conditions;
  /** すでに候補を出したか */
  proposed: boolean;
  /** 取り込んだ材料の名前 */
  materials: string[];
  /** もう診断したか */
  diagnosed: boolean;
  /** 会社のいま（Work の一覧など） */
  company: string;
  /**
   * **この往復は必ずカードになる**と、こちらが先に知っている（入口の最初の一言）。
   * 道具を必ず1つ使わせる — 「まだ決まっていない」と言ったのに文章だけが返る、を作らない。
   */
  needCard?: boolean;
  /**
   * **次にやることが決まっている**とき（→ `lib/exec/reply.ts` の「止まらない」）。
   * `record` ＝ 届いた答えを条件に写す / `ask` ＝ もっと聞く / `candidates` ＝ 候補を3つ。
   * push のある往復は**その道具だけを渡して、必ず使わせる** — 出ないことがない。
   */
  push?: 'record' | 'ask' | 'candidates';
  /**
   * **統括AIが選ばれているモデル**（メンバー画面。既定は `DEFAULT_PREF.exec.model`）。
   * 呼ぶ側が1回だけ読んで持ち回る — 続きの往復ごとに保存先を読みに行かない。
   * **深さはここでは使わない。** 会話の返事はいつも速く返す（深さは計画と判断のとき）。
   */
  model?: string;
  /** 続きの往復のために持ち回る（同じスレッドの探索・事業） */
  discoveryId?: string;
  profileId?: string;
};

/**
 * **会話の考え方**（2026-08-25 に一本に締め直した）。
 *
 * 元になっている1つの考え —
 *   社長がここに書くのは「やりたいこと」か「困っていること」で、
 *   **どちらも、そのままでは仕事にならない**。会話の仕事は、それを
 *   **押せる形**（質問カード / 候補3つ / 診断 / Work の提案）に変えること。
 *   だから**統括AIの番は、次に押せるものか、答えそのもので終わる**。
 *   文章だけで終わっていい往復は、**社長が何かを尋ねたとき**だけ。
 *
 * 書き方の決めごと:
 *   ・**同じことを二度書かない**（前は ask の回数の決まりが2か所にあった）
 *   ・**段ごとに一手**。いまどこにいるかは `stageLine` が毎回言う（推測させない）
 *   ・**画面の作りを言葉で説明しない**（板・カードの見た目は画面の仕事）
 */
const GUIDE = `
## この会話でやること
社長と1対1で話しています。日本語で短く（1〜4行）。

**あなたの番は、次のどれかで終わります。**
- 社長が尋ねたことへの**答え**（会社のこと・調べもの・雑談 — 文章だけでよい）
- **聞くこと**（ask）／**候補3つ**（propose_candidates）／**診断**（report_diagnosis）／
  **Work の提案**（propose_work）
文章だけで終わっていいのは、**尋ねられたときだけ**です。
用があって書いてきたのに何も押せないと、会話はそこで死にます。

## 会社のことを聞かれたら
下の「いまの会社」に**事実**があります。そこから答えてください。
書いていないことは知らないと言う。数字を作らない。
「社長を待っているもの」があるなら、**聞かれていなくても一言添えます**
（判断待ち・要確認は、放っておくと会社が止まるところです）。

## 尋ねるときは、必ず ask
**本文の中で質問を並べない。** 「どうしますか？」「どれがいいですか？」
「何ができたら終わりですか？」も、ぜんぶ ask にします。
本文は「いくつか教えてください」くらいに留めます。

- **押すだけで答えられる形に。** 1問は1行で読めて、選択肢は3〜4個
- 選択肢には1行の説明を付け、推すものを1つ決める
- 自由入力の行は自動で付く。言い尽くせない質問（得意・興味）は
  選択肢を「よくある例」にして、自由入力に任せてよい
- 1度に出すのは1〜4問。**回数の上限は無い** —
  適切な提案ができるまで、必要なだけ聞いてよい。
  **分かったふりで候補を出すより、もう1巡聞くほうがいい**（中身の無い3案は選べない）
- **もう分かっていることを聞き直さない**（下の「集まっている条件」を見る）
- 答えは「質問 → 答え」の形で届く。**全部 set_conditions に写してから**次へ進む

## 三つの道
**① やりたいことがある・案を持って来た**
社長の案を捨てて別の話をしない。
- 形が1つに絞れている → 確かめの ask（誰に / 何を / いつまで）→ propose_work
- 方向が複数あり得る → **その案のバリエーションを3つ** propose_candidates
  （ゼロから別業種を出さない。軸は社長の案のまま、狭め方・売り方を変える）

**② 何をやるか決めたい・迷っている**
1巡目は**誰でも押すだけで答えられること**（使える時間 / 使えるお金 /
やりたくないこと / これまでの経験・得意）。
**分野を最初に選択肢で聞かない** — 分野は無数にあり、一覧から選ばせるのは無理があります。
2巡目で方向を聞くときは、**1巡目の答えから導いた、その人に合わせた選択肢**にする
（得意が「英語」なら 英語を教える / 英語で書く / 英語の道具を作る ＋ 自由入力）。
聞きながら set_conditions に写す（分野・方向は interests）。
社長の言葉から明らかなら、聞かずに推定して写してよい。

**その人に合った具体的な候補が書けるようになったら** propose_candidates で3つ。

**候補は「実際に需要があって、社長ひとりで回せる仕事」だけです。**
- **すでにお金か時間を使っている人がいるところ**から選ぶ。
  「あったら便利そう」で選ばない — 便利そうなものに、人はお金を払いません
- **社長はひとりで、人を雇いません。** 人手・在庫・設備・許認可が要るものは、
  どれだけ需要があっても候補になりません。**使える時間を超えるものも同じ**
- **誰が買うのか（who）と、最初の1人をどこで見つけるか（first_one）が
  書けないなら、それは候補ではありません。**
  「個人」「中小企業」「困っている人」は、書いたことになりません
- **あなたは Web を見ていません。** 需要はあなたの記憶から言っているだけなので、
  **unsure に「まだ確かめていないこと」を必ず書く**。
  それが確かめられるのは、**作ったものを公開したとき**です
  （順番は 作る → 整える → 公開する → そこから広げる）

- 候補は**その分野の具体的な事業**。「テンプレート制作」ではなく
  「飲食店むけのメニュー表テンプレート」— **誰に何を**が分かる名前
- **3つは選び方が変わる形で違える**（相手が違う / 売り方が違う / 狭さが違う）。
  言い換えを3つ並べない（社長が選べない）
- 「もういいから出して」と言われたら、足りない分は仮に置いて出す（summary にそう書く）
- **「どれも違う」と言われたら、すぐ出し直さない。** 何が違うかを ask で1問だけ聞き
  （相手 / 売り方 / 分野そのもの ＋自由入力）、写してから**違う軸で**出し直す

**③ すでに事業がある**（サイト・資料・数字を渡された）
remember_material で覚える。そろったら describe_business → report_facts → report_diagnosis。

## 守ること
- **Work は勝手に作らない。** propose_work は提案で、作るのは社長が押したとき
- **答えは答えであって、新しいゴールではない。**「質問 → 答え」が届いたら、
  それは条件です。**質問文や答えを題にした propose_work をしない**
- 雑談・調べもので済む話に Work は要らない。**要らないときは提案しない**
- **この会話でもう Work を作っているなら、propose_work は二度と呼ばない**
- 分からないことは分からないと言う。知らない数字を作らない`;

/* ══════════════ いまどこにいるか ══════════════ */

/** そろっている条件の数（値が入っているもの）。**6項目のうち何個か** */
export const filled = (c: Conditions) =>
  [c.interests.length || null, c.hoursPerWeek, c.budgetJpy,
   c.strengths.length || null, c.avoid.length || null, c.deadline]
    .filter((v) => v !== null && v !== undefined).length;

/**
 * **候補を出していいか。**
 * 分野（何の話か）が分からないまま出すと、「小さな実用品の販売所」のように
 * **何に関するものか誰にも分からない案**になる（実際そうなった）。
 * だから分野は必須。そのうえで、ほかの条件が2つ以上そろっていること。
 */
export const canPropose = (c: Conditions | undefined) =>
  !!c && c.interests.length > 0 && filled(c) >= 3;

/** まだ聞けていない条件の名前（次に何を聞くかが、そのまま出る） */
const missing = (c: Conditions): string[] => [
  c.interests.length ? '' : '分野・方向',
  c.hoursPerWeek ? '' : '使える時間',
  c.budgetJpy ? '' : '使えるお金',
  c.strengths.length ? '' : '得意・経験',
  c.avoid.length ? '' : 'やりたくないこと',
  c.deadline ? '' : 'いつまでに',
].filter(Boolean);

/**
 * **いまどこにいるかを、毎回そのまま言う。**
 *
 * 前は状態の断片（条件・候補を出したか・材料）だけを並べていたので、
 * モデルは往復のたびに「この会話はどの道の、どの段か」を推測し直していた。
 * 推測は外れる — 実際、条件を書き留めただけで止まる／同じことを聞き直す、が起きた。
 * 段が分かっていれば、次の一手は1つに決まる。
 */
function stageLine(s: ChatState): string {
  if (s.hasWork) return 'いまの段: **この会話はもう Work を持っています。** 相談に答えてください（新しい Work は作らない）';
  if (s.diagnosed) return 'いまの段: 診断まで出しました。社長が Work にするのを待ちます';
  if (s.materials.length) return `いまの段: 事業の材料を ${s.materials.length}件 預かりました（③ の道）。そろえば診断まで進みます`;
  if (s.proposed) return 'いまの段: 候補を出しました。社長が選ぶのを待ちます（「どれも違う」なら、何が違うかを1問聞いてから軸を変えて出し直す）';
  if (s.conditions) {
    const left = missing(s.conditions);
    return canPropose(s.conditions)
      ? `いまの段: 探索中（② の道）。条件は ${filled(s.conditions)}/6。**候補を出せます**`
      : `いまの段: 探索中（② の道）。条件は ${filled(s.conditions)}/6。`
        + `まだ聞けていないのは ${left.join(' / ')} — **次は聞く番です**`;
  }
  return 'いまの段: まだ探索も取り込みも始まっていません。社長の一言から、①〜③ のどれかを選んでください';
}

/**
 * 1往復ぶんの口。**本文は流しながら渡す**（`onText`）ので、
 * 画面は最初の1文字が届いた時点から出せる（→ `app/api/chat/route.ts`）。
 */
export type ChatOpts = {
  /** 本文が1かたまり届くたびに呼ばれる */
  onText?: (chunk: string) => void;
  /** **いま何をしているか**が変わるたびに呼ばれる（画面にそのまま出る日本語） */
  onStage?: (stage: string) => void;
  /** 思考の断片（開示するモデルのときだけ）。画面の「考えています」に流す */
  onThink?: (chunk: string) => void;
  signal?: AbortSignal;
};

/**
 * 道具の名前 → **社長に見せる一言**。
 * Claude の「〇〇中…」と同じ考え方で、**起きている事実だけ**を書く。
 * 知らない道具が来たら黙る（作り話をしない）。
 */
const STAGE: Record<string, string> = {
  ask: '聞くことをまとめています',
  set_conditions: '条件を書き留めています',
  propose_candidates: '条件に合う道を組み立てています',
  remember_material: '渡された資料を読んでいます',
  describe_business: '事業の形を捉えています',
  report_facts: '数字を並べています',
  report_diagnosis: '診断をまとめています',
  propose_work: 'Work の形にしています',
};

export async function chatStep(state: ChatState, history: Msg[], opts: ChatOpts = {}): Promise<ChatOut> {
  const real = hasKey('fast');
  const p = real ? providerFor('fast') : new FakeProvider();

  /**
   * **何で動いているかを、統括AI自身に知らせる。**
   * 知らなければ答えようがなく、「聞かれない限り話に出さない」に逃げるしかない
   * （実際そうなった）。どのモデルを使うかは社長が選んだ設定なので、隠すものではない。
   */
  const lines = [
    real
      ? `あなたが動いているモデル: ${labelFor('fast', state.model)}。**聞かれたらモデル名だけ答える**（通り道や社内の作りは言わない）`
      : 'いまはモデルの鍵が無く、決め打ちの仮の返事を返しています。聞かれたらそう答えてください',
    // **段は毎回いちばん上に。** 状態の断片から推測させない（→ stageLine）
    stageLine(state),
    `いまの会社:\n${state.company}`,
  ];
  if (state.conditions) lines.push(`集まっている条件:\n${JSON.stringify({
    interests: state.conditions.interests,
    hours_per_week: state.conditions.hoursPerWeek ?? null,
    budget_jpy: state.conditions.budgetJpy ?? null,
    strengths: state.conditions.strengths,
    avoid: state.conditions.avoid,
    deadline: state.conditions.deadline ?? null,
  })}`);
  /**
   * **答えが届いた往復は、その1回で写して、次の一手まで出す。**
   * 道具は複数呼べるので、往復を分ける理由がない（前は写す往復と出す往復で2回呼んでいた）。
   */
  if (state.needCard && !state.push && /\n→ /.test(String(history[history.length - 1]?.content ?? ''))) {
    lines.push('**社長の答え（「質問 → 答え」の行）が届いています。**'
      + 'この往復で set_conditions に全部写し、**そのうえで次の一手まで出してください** —'
      + '条件がそろっていれば propose_candidates、足りなければ ask。'
      + '写すだけで終わらせない（社長の番が来ないまま会話が止まります）。');
  }
  if (state.push === 'record') {
    lines.push('**直前の社長の答え（「質問 → 答え」の行）を、set_conditions に全部写してください。**'
      + '分野・方向にあたる答えは interests に。この往復は写すだけです。');
  }
  if (state.push === 'candidates') {
    lines.push('**条件はもう十分そろっています。この往復で propose_candidates を呼び、候補を3つ出してください。**'
      + '足りない条件があっても、仮に置いて出します（仮に置いたことは summary に書く）。'
      + '候補の名前は、集まった条件の分野・得意を使って**誰に何を**が分かる形に。');
  }
  if (state.push === 'ask') {
    const noField = !state.conditions?.interests.length;
    lines.push('**この往復では ask を呼んで、押すだけで答えられる質問を1〜4問してください。**'
      + '（回数は決まっていません。分かるまで何巡でも聞いてかまいません。）'
      + (noField
          ? '時間・お金・避けたいこと・得意なことのうち、まだ聞けていないものを。'
            + '方向を聞くときは、**これまでの答えから導いた選択肢**＋自由入力で（一般的な分野一覧を出さない）。'
          : 'まだ条件が足りないので、候補は出しません。'));
  }
  if (state.materials.length) lines.push(`取り込んだ材料: ${state.materials.join(' / ')}`);

  const got = new Map<string, Record<string, unknown>>();
  const many: Record<string, unknown>[] = [];
  let text = '';
  let stop: string | null = null;

  // 前置きは2度めの往復（本文だけ書いてもらう）でも同じものを使う
  const sys = `${CONSTITUTION}\n${GUIDE}\n\n${lines.join('\n\n')}`;

  /**
   * **push のある往復は、その道具しか渡さない。**
   * 「必ず使え」と書くだけでは守られない（required でも別の道具に逃げる）。
   * 道具が1つなら、出力は必ずその形になる — 「続きが出ない」が構造的に起きない。
   */
  const TOOLS = [ask, setConditions, proposeCandidates, rememberMaterial, describeBusiness, reportFacts, reportDiagnosis, proposeWork];
  const tools = state.push === 'record' ? [setConditions]
    : state.push === 'ask' ? [ask]
    : state.push === 'candidates' ? [proposeCandidates]
    : TOOLS;

  for await (const c of p.stream({
    tier: 'fast',
    model: state.model,
    system: sys,
    messages: history,
    tools,
    maxTokens: 8000,
    effort: 'low',
    ...(state.needCard || state.push ? { toolChoice: 'required' as const } : {}),
    signal: opts.signal,
  })) {
    if (c.type === 'text') { text += c.text; opts.onText?.(c.text); }
    if (c.type === 'think') opts.onThink?.(c.text);
    if (c.type === 'tool_begin' && STAGE[c.name]) opts.onStage?.(STAGE[c.name]);
    if (c.type === 'tool_use') {
      const input = (c.input ?? {}) as Record<string, unknown>;
      // 材料は1往復で何個来てもいい（ほかの道具は最後の1つが勝つ）
      if (c.name === 'remember_material') many.push(input);
      else got.set(c.name, input);
    }
    if (c.type === 'done') stop = c.stopReason;
  }
  checkStop(stop, got.keys(), '返事が長すぎて途中で切れました。短く聞き直してみてください');

  const cRaw = got.get('set_conditions') ?? {};
  const conditions: Partial<Conditions> = {};
  if (Array.isArray(cRaw.interests) && cRaw.interests.length) conditions.interests = cRaw.interests.map(String);
  const hours = finite(cRaw.hours_per_week);
  if (hours !== undefined) conditions.hoursPerWeek = hours;
  const budget = finite(cRaw.budget_jpy);
  if (budget !== undefined) conditions.budgetJpy = budget;
  if (Array.isArray(cRaw.strengths) && cRaw.strengths.length) conditions.strengths = cRaw.strengths.map(String);
  if (Array.isArray(cRaw.avoid) && cRaw.avoid.length) conditions.avoid = cRaw.avoid.map(String);
  if (cRaw.deadline != null && cRaw.deadline !== '') conditions.deadline = String(cRaw.deadline);

  const candidates = ((got.get('propose_candidates')?.candidates as Record<string, unknown>[]) ?? [])
    .map((x): CandidateDraft => ({
      name: String(x.name ?? ''), summary: String(x.summary ?? ''),
      ending: String(x.ending ?? ''),
      why: Array.isArray(x.why) ? x.why.map(String) : [],
      fit: {
        demand: score((x.fit as Record<string, unknown>)?.demand),
        solo: score((x.fit as Record<string, unknown>)?.solo),
        speed: score((x.fit as Record<string, unknown>)?.speed),
      },
      recommended: !!x.recommended,
      notChosenWhy: x.not_chosen_why ? String(x.not_chosen_why) : undefined,
      who: x.who ? String(x.who) : undefined,
      firstOne: x.first_one ? String(x.first_one) : undefined,
      unsure: x.unsure ? String(x.unsure) : undefined,
      hoursPerWeek: Number.isFinite(Number(x.hours_per_week)) ? Math.max(0, Math.round(Number(x.hours_per_week))) : 0,
    }))
    .filter((x) => x.name);

  const findings = ((got.get('report_diagnosis')?.findings as Record<string, unknown>[]) ?? [])
    .map((f): Finding => ({
      severity: (['重い', '中くらい', '軽い'] as const).find((s) => s === f.severity) ?? '中くらい',
      title: String(f.title ?? ''), why: String(f.why ?? ''),
      evidence: Array.isArray(f.evidence) ? f.evidence.map(String) : [],
      work: {
        title: String((f.work as Record<string, unknown>)?.title ?? ''),
        goal: String((f.work as Record<string, unknown>)?.goal ?? ''),
        weeks: Number((f.work as Record<string, unknown>)?.weeks ?? 0),
      },
    }))
    .filter((f) => f.title && f.work.title);

  const w = got.get('propose_work');
  // **もう Work があるなら、提案が来ても捨てる**（1チャット=1Work の最後の砦）
  const work = w && !state.hasWork
    ? { title: String(w.title ?? ''), goal: String(w.goal ?? ''), weeks: Number(w.weeks ?? 0), why: String(w.why ?? '') }
    : undefined;

  const biz = got.get('describe_business');

  const out: ChatOut = {
    real, text: text.trim(),
    questions: toQuestions(got.get('ask')?.questions),
    conditions, candidates,
    materials: many.map((m) => ({
      kind: (['site', 'doc', 'sheet'] as const).find((k) => k === m.kind) ?? 'doc',
      locator: String(m.locator ?? '').slice(0, 200),
      content: m.content ? String(m.content).slice(0, 4000) : undefined,
    })).filter((m) => m.locator),
    business: biz ? { name: biz.name ? String(biz.name) : undefined, stage: biz.stage ? String(biz.stage) : undefined } : undefined,
    facts: ((got.get('report_facts')?.facts as Record<string, unknown>[]) ?? []).map((f): Fact => ({
      label: String(f.label ?? ''), value: String(f.value ?? '—'),
      note: f.note ? String(f.note) : undefined, missing: !!f.missing,
    })).filter((f) => f.label),
    findings,
    work: work?.title ? work : undefined,
  };

  // **黙って何も起きない、を作らない**（押しても画面が変わらない、の禁止）
  const cards = cardWords(out);
  if (!out.text && !cards.length) {
    /**
     * **絞られた往復（push）の空振りは、エラーではない。**
     * required でも引数が空で来ることはある（写すものが無かった・JSON が途切れた）。
     * ここで投げると、**もう書き終わった正常な返事ごと**「うまく応えられませんでした」になる。
     * 空のまま返して、続きの輪（→ reply.ts）に次の一手を出させる。
     */
    if (state.push) return out;
    throw new AppError('upstream', `empty chat turn (stop=${stop})`,
      undefined, '統括AIが応えませんでした。もう一度お試しください');
  }

  /**
   * **道具を呼んだ往復には本文が来ない。**
   * OpenAI 互換のモデルは `tool_calls` を返すとき `content` を空にするのがふつうで、
   * 「道具を呼ぶときも本文を書け」と頼んでも守られない（実際 Luna で
   * 「（返事がありませんでした）」だけが並んだ）。
   * だから**足りないときは、もう一度だけ短く書いてもらう** — 道具は渡さないので必ず文が来る。
   */
  /**
   * **条件を写しただけの往復は、言葉を作らない。**
   * このあと続きの往復（質問か候補）が必ず走って、そちらが言葉を持つ（→ reply.ts）。
   * ここで一言作らせると「もう1つ条件をもらえると出せます」と言った**直後に候補が出る** —
   * 言葉と行動が食い違う（実際そうなった）。
   */
  const condOnly = Object.keys(conditions).length > 0
    && !out.questions.length && !out.candidates.length && !out.findings.length
    && !out.work && !out.materials.length;
  if (!out.text && cards.length && state.push !== 'record' && !condOnly) {
    opts.onStage?.('言葉にしています');
    out.text = await prose(p, sys, history, cards, opts, state.model);
  }
  return out;
}

/** いま画面に出るカードを、ひとことで言い直す（2度めの往復に渡す） */
function cardWords(o: ChatOut): string[] {
  const w: string[] = [];
  if (o.questions.length) w.push(`聞きたいこと ${o.questions.length}問（選択肢つき）`);
  if (o.candidates.length) w.push(`条件に合う道 ${o.candidates.length}つ（${o.candidates.map((c) => c.name).join(' / ')}）`);
  if (o.findings.length) w.push(`診断で見つかったこと ${o.findings.length}件`);
  if (o.work) w.push(`Work の提案「${o.work.title}」`);
  if (o.materials.length) w.push(`覚えた材料 ${o.materials.length}件`);
  if (Object.keys(o.conditions).length) w.push('条件の書き足し');
  return w;
}

/**
 * カードに添える1〜3行。**道具を渡さない**ので、必ず文が返る。
 * 倒れてもカードは出したいので、**ここで投げない** — 最後の手として決め打ちの1行を返す。
 */
async function prose(
  p: ModelProvider, system: string, history: Msg[], cards: string[], opts: ChatOpts,
  model?: string,
): Promise<string> {
  try {
    let out = '';
    for await (const c of p.stream({
      tier: 'fast',
      model,
      system: [
        system, '',
        '## いま',
        'あなたはもう手を動かしました。社長の画面には次が出ます:',
        ...cards.map((x) => `- ${x}`),
        '',
        '**それに添える短い返事だけ**を日本語で書いてください（1〜3行）。',
        'カードの中身は繰り返さない。道具はもう呼ばない。',
      ].join('\n'),
      messages: history,
      maxTokens: 400,
      effort: 'low',
      signal: opts.signal,
    })) {
      if (c.type === 'text') { out += c.text; opts.onText?.(c.text); }
    }
    const said = out.trim();
    if (said) return said;
  } catch { /* 下の1行に落ちる */ }
  const fallback = cards.length === 1 ? `${cards[0]}を出しました。` : '下にまとめました。';
  opts.onText?.(fallback);
  return fallback;
}
