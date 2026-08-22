/**
 * Phase 4 のダミーデータ。**ここが唯一の出どころ**。
 *
 * 中身は `design/canvas/*.dc.html`（画面設計）を正としている。
 * 設計どうしで食い違っていたところは、以下を採った:
 *   ・フェーズ名は **調査 / 戦略 / プロダクト / ローンチ**（計画の承認・Work 画面・CLAUDE.md と一致）
 *   ・在籍は4人（調査・戦略・企画・開発）。執筆担当は採用提案、品質・分析は採用候補
 *   ・AI社員の色は**オフィスと進捗の可視化だけ**。表・リスト・ピルには出さない
 */

export type EmployeeColor = 'cyan' | 'purple' | 'indigo' | 'green';

export const AGENT_COLOR: Record<EmployeeColor, string> = {
  cyan: '#2AA9BF', purple: '#9A5CD0', indigo: '#5C6BC0', green: '#34A853',
};

/** 状態は6語だけ。この外に新しい言い方を作らない */
export type State = '判断待ち' | '要確認' | '実行中' | '待機' | '完了' | '承認済';
/** 遅れているかどうかは2語だけ */
export type Health = '順調' | { late: number };

export const COMPANIES = [
  { id: 'kotonoha', name: 'ことのは', works: 3, current: true },
  { id: 'minamo', name: 'みなも', works: 1, current: false },
];
export const ME = { initial: 'Y', name: 'あなた' };

// ════════════════════════ AI社員 ════════════════════════

export type Employee = {
  id: string; name: string; role: string; color: EmployeeColor;
  state: State; now: string; load: number; tasks: number; deliverables: number; since: string;
};

export const EMPLOYEES: Employee[] = [
  { id: 'e-research', name: '調査担当', role: '調査・競合分析', color: 'cyan',
    state: '実行中', now: '競合ポジショニング分析', load: 74, tasks: 4, deliverables: 5, since: '8月14日' },
  { id: 'e-strategy', name: '戦略担当', role: '収益設計・価格', color: 'purple',
    state: '要確認', now: '収益モデル比較レポート', load: 41, tasks: 3, deliverables: 2, since: '8月14日' },
  { id: 'e-dev',      name: '開発担当', role: '実装・テスト', color: 'green',
    state: '実行中', now: '申込フォームの実装', load: 62, tasks: 2, deliverables: 1, since: '8月17日' },
  { id: 'e-plan',     name: '企画担当', role: '要件・仕様', color: 'indigo',
    state: '実行中', now: '投稿カレンダー作成', load: 38, tasks: 4, deliverables: 2, since: '8月16日' },
];
export const employee = (id: string) => EMPLOYEES.find((e) => e.id === id)!;

/** 統括AIからの採用提案（1件だけ。無ければ提案の行そのものを出さない） */
export const HIRE_SUGGESTION = {
  id: 'c-writer', name: '執筆担当', reason: 'フェーズ3の記事とLPの文章を書ける社員がいません',
};

export const HIRE_CANDIDATES = [
  { id: 'c-writer',  name: '執筆担当', en: 'Content Writer', color: 'cyan' as EmployeeColor,
    lead: '調べたことを、読める文章にします。',
    can: ['記事', 'LPの文章', 'メール'], forWork: 'フェーズ3の記事とLP', recommended: true,
    skills: ['記事の書き方', '見出しの付け方'] },
  { id: 'c-quality', name: '品質担当', en: 'QA Engineer', color: 'indigo' as EmployeeColor,
    lead: '出す前に、壊れているところを見つけます。',
    can: ['動作確認', 'リンク切れ', '表記ゆれ'], forWork: '公開フェーズの前', recommended: false,
    skills: ['チェックリストの作り方'] },
  { id: 'c-analyst', name: '分析担当', en: 'Data Analyst', color: 'purple' as EmployeeColor,
    lead: '数字を見て、次に何を変えるかを言います。',
    can: ['アクセス解析', 'A/Bの設計', '週次レポート'], forWork: '公開したあと', recommended: false,
    skills: ['指標の決め方', 'A/Bの読み方'] },
];

// ════════════════════════ Work ════════════════════════

export type Phase = {
  name: string; goal: string; state: 'done' | 'now' | 'next';
  x: number; w: number;              // 進捗のタイムライン上の位置（軸 0-100）
  done: number; all: number;         // タスク
  from: string; to: string;          // 日付
  owner?: string;
};

export type Work = {
  id: string; title: string; goal: string;
  phaseIndex: number; progress: number; health: Health; state: State; restDays: number; endDate: string;
  phases: Phase[];
  /** x = 進捗レーンの日付軸上の位置 / ring = オフィスの輪の上の位置。**別の座標系** */
  crew: { id: string; x: number; ring: number; dim?: boolean }[];
  gate?: { x: number; label: string };
  over?: { x: number; w: number; label: string };
};

export const TODAY_X = 35.7;

/** 放っておけない順（遅れ → 判断待ち → 順調）。タスク一覧と同じ規則 */
export const WORKS: Work[] = [
  {
    id: 'w-sns', title: 'SNS運用の立ち上げ', goal: '毎週まわる投稿の型を作る',
    phaseIndex: 2, progress: 38, health: { late: 2 }, state: '実行中', restDays: 6, endDate: '8/27',
    phases: [
      { name: '方針',   goal: '誰に何を出すかを決める', state: 'done', x: 1.8,  w: 12.5, done: 3, all: 3, from: '8/12', to: '8/16', owner: 'e-plan' },
      { name: '運用設計', goal: '投稿の型と本数を決める', state: 'now',  x: 14.3, w: 14.3, done: 1, all: 4, from: '8/16', to: '8/21', owner: 'e-plan' },
      { name: '実行',   goal: '4週ぶんを出しきる',     state: 'next', x: 35.7, w: 21.4, done: 0, all: 5, from: '8/21', to: '8/27' },
    ],
    crew: [{ id: 'e-plan', x: 21, ring: 45 }],
    over: { x: 28.6, w: 7.1, label: '+2日' },
  },
  {
    id: 'w-japanese', title: '日本語学習サービス', goal: '韓国の社会人に、読解でつまずかない学習体験を届ける',
    phaseIndex: 2, progress: 52, health: '順調', state: '判断待ち', restDays: 16, endDate: '9/6',
    phases: [
      { name: '調査',     goal: '市場・競合・ターゲットを確かめる', state: 'done', x: 7.1,  w: 21.5, done: 3, all: 3, from: '8/13', to: '8/19', owner: 'e-research' },
      { name: '戦略',     goal: '収益モデルと価格を決める',       state: 'now',  x: 28.6, w: 28.5, done: 1, all: 3, from: '8/19', to: '8/27', owner: 'e-strategy' },
      { name: 'プロダクト', goal: 'MVPの要件を固めて作る',        state: 'next', x: 57.1, w: 21.5, done: 0, all: 4, from: '8/27', to: '9/2' },
      { name: 'ローンチ',   goal: '初期ユーザーを集める',          state: 'next', x: 78.6, w: 14.3, done: 0, all: 3, from: '9/2',  to: '9/6' },
    ],
    crew: [{ id: 'e-research', x: 44, ring: 68 }, { id: 'e-strategy', x: 53, ring: 32, dim: true }],
    gate: { x: TODAY_X, label: '価格モデルの決定' },
  },
  {
    id: 'w-lp', title: 'LPと申込フォーム', goal: '問い合わせが来る状態にする',
    phaseIndex: 2, progress: 61, health: '順調', state: '実行中', restDays: 12, endDate: '9/2',
    phases: [
      { name: '要件', goal: '載せることを決める', state: 'done', x: 10.7, w: 17.9, done: 3, all: 3, from: '8/14', to: '8/19', owner: 'e-plan' },
      { name: '制作', goal: '作って動かす',       state: 'now',  x: 28.6, w: 28.5, done: 2, all: 4, from: '8/19', to: '8/27', owner: 'e-dev' },
      { name: '公開', goal: '出して計測する',     state: 'next', x: 57.1, w: 21.5, done: 0, all: 2, from: '8/27', to: '9/2' },
    ],
    crew: [{ id: 'e-dev', x: 43, ring: 62 }],
  },
];

export const work = (id: string) => WORKS.find((w) => w.id === id)!;
export const DONE_WORKS = 2;

export const TICKS = [
  { x: 0, label: '8/11' }, { x: 25, label: '8/18' }, { x: 50, label: '8/25' },
  { x: 75, label: '9/1' }, { x: 100, label: '9/8' },
];

// ════════════════════════ タスク ════════════════════════

export type Task = {
  title: string; state: State; progress: number;
  owner: string | 'me'; due: string; workId: string; phase: string;
};

/** 放っておけない順（判断待ち → 要確認 → 実行中 → 待機 → 完了） */
export const TASKS: Task[] = [
  { title: '価格モデルの決定',      state: '判断待ち', progress: 90,  owner: 'me',         due: '8月21日', workId: 'w-japanese', phase: '戦略' },
  { title: '収益モデル比較レポート', state: '要確認',  progress: 100, owner: 'e-strategy', due: '8月21日', workId: 'w-japanese', phase: '戦略' },
  { title: '競合ポジショニング分析', state: '実行中',  progress: 62,  owner: 'e-research', due: '8月21日', workId: 'w-japanese', phase: '調査' },
  { title: '申込フォームのコピー',   state: '実行中',  progress: 48,  owner: 'e-strategy', due: '8月22日', workId: 'w-lp',       phase: '制作' },
  { title: '投稿カレンダー作成',     state: '実行中',  progress: 30,  owner: 'e-plan',     due: '8月22日', workId: 'w-sns',      phase: '運用設計' },
  { title: '申込フォームの実装',     state: '実行中',  progress: 45,  owner: 'e-dev',      due: '8月23日', workId: 'w-lp',       phase: '制作' },
  { title: '競合1社の料金を調べる',  state: '実行中',  progress: 40,  owner: 'e-research', due: '8月21日', workId: 'w-japanese', phase: '調査' },
  { title: '価格戦略ドラフト',       state: '実行中',  progress: 32,  owner: 'e-strategy', due: '8月21日', workId: 'w-japanese', phase: '戦略' },
  { title: '収益シミュレーション',   state: '待機',    progress: 0,   owner: 'e-strategy', due: '8月23日', workId: 'w-japanese', phase: '戦略' },
  { title: '初回10投稿の下書き',     state: '待機',    progress: 0,   owner: 'e-plan',     due: '8月25日', workId: 'w-sns',      phase: '実行' },
  { title: '市場規模の推計',         state: '完了',    progress: 100, owner: 'e-research', due: '8月14日', workId: 'w-japanese', phase: '調査' },
  { title: '発信テーマの洗い出し',   state: '完了',    progress: 100, owner: 'e-research', due: '8月16日', workId: 'w-sns',      phase: '方針' },
  { title: 'ワイヤーフレーム作成',   state: '完了',    progress: 100, owner: 'e-plan',     due: '8月19日', workId: 'w-lp',       phase: '要件' },
  { title: 'LPの見出しを3案',        state: '完了',    progress: 100, owner: 'e-plan',     due: '8月20日', workId: 'w-lp',       phase: '要件' },
  { title: 'LPのコーディング',       state: '完了',    progress: 100, owner: 'e-dev',      due: '8月19日', workId: 'w-lp',       phase: '制作' },
];

// ════════════════════════ 成果物 ════════════════════════

/** サムネイルは中身を出す。灰色の棒は置かない */
export type Preview =
  | { kind: 'text'; cap: string; lines: string[] }
  | { kind: 'table'; cap: string; rows: [string, string, string][]; hi: number }
  | { kind: 'bars'; cap: string; values: number[] };

export type Deliverable = {
  id: string; title: string; by: string; when: string; version: string;
  state: State | '生成中'; workId: string; preview: Preview;
};

export const DELIVERABLES: Deliverable[] = [
  { id: 'd-rev', title: '収益モデル比較レポート', by: 'e-strategy', when: '2時間前', version: 'v1',
    state: '要確認', workId: 'w-japanese',
    preview: { kind: 'table', cap: '3つの価格帯', hi: 1,
      rows: [['A', '¥980', '—'], ['B', '¥1,980', '61%'], ['C', '¥3,980', '22%']] } },
  { id: 'd-mkt', title: '市場調査レポート v2', by: 'e-research', when: '2日前', version: 'v2',
    state: '承認済', workId: 'w-japanese',
    preview: { kind: 'text', cap: '韓国の日本語学習市場', lines: [
      '学習者は約64万人（2024・国際交流基金）。',
      '20〜30代の社会人が全体の46%を占め、',
      '独学が続かない層に受け皿がない。'] } },
  { id: 'd-target', title: 'ターゲット定義', by: 'e-research', when: '4日前', version: 'v1',
    state: '承認済', workId: 'w-japanese',
    preview: { kind: 'text', cap: 'だれに売るか', lines: [
      'ソウル在住・25〜34歳・会社員。',
      'JLPT N3を目指して独学が3ヶ月続いた人。',
      '読解でつまずいて止まっている。'] } },
  { id: 'd-tam', title: 'TAM / SAM 試算', by: 'e-strategy', when: '', version: '',
    state: '生成中', workId: 'w-japanese',
    preview: { kind: 'bars', cap: '市場の大きさ', values: [38, 62, 44, 88, 30, 56] } },
  { id: 'd-price', title: '競合12社の料金表', by: 'e-research', when: '5日前', version: 'v1',
    state: '承認済', workId: 'w-japanese',
    preview: { kind: 'text', cap: '公開されている価格', lines: [
      '月額の中央値は¥2,400。最安は¥900の',
      'アプリ型で、講師つきは¥12,000から。',
      '年払いのみの割引は3社だけ。'] } },
  { id: 'd-persona', title: 'ペルソナ仮説 3パターン', by: 'e-strategy', when: '6日前', version: 'v1',
    state: '承認済', workId: 'w-japanese',
    preview: { kind: 'text', cap: 'だれから当てるか', lines: [
      '①独学が止まった会社員 ②駐在の帯同家族',
      '③K-POP起点の学生。①が最も金額を',
      '出せるが、母数は②のほうが大きい。'] } },
];

/** 右ペインに開いている成果物の中身 */
export const DELIVERABLE_BODY = {
  id: 'd-rev',
  lead: '韓国在住20〜30代・初中級を対象に、3つの価格帯を比較した。継続率は競合12件の公開値と当社の無料期間データから推定している。',
  table: {
    head: ['案', '月額', '想定継続率', '12か月LTV'],
    rows: [['A', '¥980', '—', '推定不可'], ['B', '¥1,980', '61%', '¥14,500'], ['C', '¥3,980', '22%', '¥10,500']],
    hi: 1, bars: [0, 61, 22],
  },
  conclusion: 'B案を推奨する。A案は無料期間との差が小さく継続率が読めない。C案は支払意思の上限を超える。',
};

// ════════════════════════ 決定事項（追記のみの台帳）════════════════════════

export type DecOption = { label: string; value: string; note: string; pct: number; recommended?: boolean };
export type Decision = {
  id: string; question: string; when: string; workId: string;
  state: '判断待ち' | '承認済';
  options?: DecOption[];
  chosen?: string; basis?: string;
};

export const DECISIONS: Decision[] = [
  { id: 'dec-price', question: '価格モデルの決定', when: '3時間前', workId: 'w-japanese', state: '判断待ち',
    options: [
      { label: 'A案', value: '¥980',   note: '継続率が読めない',   pct: 0 },
      { label: 'B案', value: '¥1,980', note: '推奨',               pct: 61, recommended: true },
      { label: 'C案', value: '¥3,980', note: '支払意思を超える',   pct: 22 },
    ] },
  { id: 'dec-free', question: '無料期間の長さ', when: '1時間前', workId: 'w-japanese', state: '判断待ち',
    options: [
      { label: '7日',  value: '7日',  note: '',           pct: 22 },
      { label: '14日', value: '14日', note: '推奨',       pct: 58, recommended: true },
      { label: '30日', value: '30日', note: '原価が重い', pct: 12 },
    ] },
  { id: 'dec-target', question: 'ターゲット', when: '4日前', workId: 'w-japanese', state: '承認済',
    chosen: '韓国在住の20〜30代・初中級', basis: '調査担当の調査に基づく · フェーズ1' },
  { id: 'dec-model', question: '事業形態', when: '4日前', workId: 'w-japanese', state: '承認済',
    chosen: 'B2C サブスクリプション', basis: '戦略担当の提案 · フェーズ1' },
];

/** 右ペインに開いている決定の中身 */
export const DECISION_BODY = {
  id: 'dec-price',
  waited: '3時間 待機',
  lead: '競合12件の中央値は ¥1,650。値ごろ感を保ちつつ、無料期間との差がはっきりする水準として B案 を推奨します。',
  basis: [
    { icon: 'deliv' as const, label: '収益モデル比較レポート' },
    { icon: 'globe' as const, label: '競合の価格 12件' },
  ],
  after: [
    { icon: 'task' as const, label: '収益シミュレーションが始まる' },
    { icon: 'roadmap' as const, label: 'フェーズ3の計画が作られる' },
  ],
  primary: 'B案で決定する', secondary: '別案にする',
};

/** Work の右レールに出す「決めたこと」 */
export const WORK_DECISIONS: Record<string, [string, string][]> = {
  'w-japanese': [['8月19日', '対象は韓国の社会人に絞る'], ['8月17日', 'まず読解に振り切る'], ['8月15日', 'アプリではなくWebで出す']],
  'w-lp': [['8月17日', 'LPを別の Work にする']],
  'w-sns': [],
};

// ════════════════════════ 通知 ════════════════════════

export type Notice = {
  id: string; kind: '判断待ち' | '要確認' | '実行中' | '承認済' | '完了';
  title: string; sub: string; when: string; unread: boolean;
  children?: [string, string][];
};

export const NOTICE_GROUPS: { label: string; items: Notice[] }[] = [
  { label: '今日', items: [
    { id: 'n1', kind: '判断待ち', title: '価格モデルの決定', sub: '判断を待っています', when: '3時間', unread: true },
    { id: 'n2', kind: '要確認', title: '成果物が2件できました。見てください', sub: '', when: '2時間', unread: true,
      children: [['収益モデル比較レポート — 戦略担当', '2時間前'], ['競合ポジショニング図 — 調査担当', '2時間前']] },
    { id: 'n3', kind: '実行中', title: '競合ポジショニング分析', sub: '調査担当が開始しました', when: '12分', unread: false },
  ] },
  { label: '昨日', items: [
    { id: 'n4', kind: '承認済', title: '市場調査レポート v2', sub: 'あなたが承認しました', when: '昨日 18:40', unread: false },
    { id: 'n5', kind: '完了', title: 'フェーズ1 調査', sub: '完了しました', when: '昨日 18:41', unread: false },
  ] },
];

// ════════════════════════ チャット ════════════════════════

export type Thread = { id: string; title: string; unread?: boolean; workId?: string };
export const THREADS: Thread[] = [
  { id: 't-price', title: '価格をどうするか', workId: 'w-japanese' },
  { id: 't-korea', title: '韓国の競合について', workId: 'w-japanese' },
  { id: 't-lp',    title: 'LPの構成', unread: true, workId: 'w-lp' },
];

// ════════════════════════ スキル ════════════════════════

export type Skill = { id: string; name: string; file: string; on: boolean; scope: 'employee' | 'company' };
export const SKILLS: Skill[] = [
  { id: 's1', name: '競合分析のやり方',   file: 'competitor-analysis.md', on: true,  scope: 'employee' },
  { id: 's2', name: '市場規模の見積もり', file: 'market-sizing.md',       on: true,  scope: 'employee' },
  { id: 's3', name: '出典の付け方',       file: 'source-citation.md',     on: true,  scope: 'company' },
  { id: 's4', name: '会社の言葉づかい',   file: 'tone-of-voice.md',       on: false, scope: 'company' },
];
export const RULES = [
  '出典のない数字を書かない。推計は前提を並べる',
  '承認済の決定に反する提案をしない',
  '分からないことは分からないと書く',
];

// ════════════════════════ 統括AIの3状態（B群の宿題）════════════════════════

export type ExecState = 'idle' | 'thinking' | 'blocked';

// ════════════════════════ デスク（手もとで何が起きているか）════════════════════════

/** 中身の器は担当ではなく produces で決める（業種を埋め込まない） */
export type DeskBody =
  | { kind: 'facts'; cap: string; n: number; items: string[] }
  | { kind: 'text'; file: string; lines: string[] }
  | { kind: 'code'; file: string; lines: [number, string, boolean][]; foot: string[] }
  | { kind: 'review'; title: string; when: string; action: string };

export type Lane = {
  id: string; state: State; line: string;
  steps: [string, string][];
  body: DeskBody;
  task: string; elapsed: string;
};

export const LANES: Lane[] = [
  { id: 'e-research', state: '実行中',
    line: '競合の継続率を、公開レポートから拾っています',
    steps: [['競合アプリ 上位20の価格を集めた', '1分12秒'], ['市場規模のレポートを3本 読んだ', '2分41秒'], ['語学アプリの継続率を拾っている', '48秒']],
    body: { kind: 'facts', cap: '抜き出した事実', n: 3, items: [
      '韓国の日本語学習者 約64万人（2024・国際交流基金）',
      '競合A 月額 ₩19,900 / 月間 12万DL',
      '競合B は会話特化。読解の受け皿が薄い'] },
    task: '競合ポジショニング分析', elapsed: '12分' },
  { id: 'e-plan', state: '実行中',
    line: 'SNSの投稿カレンダーを1ヶ月ぶん書いています',
    steps: [['先月の反応が良かった投稿を並べた', '1分38秒'], ['週3本の型に落としている', '4分22秒']],
    body: { kind: 'text', file: '投稿カレンダー.md', lines: [
      '週3本。火・木・土の朝7時に出します。',
      '火＝学習のコツ、木＝生徒の声、土＝日本の',
      '暮らし。先月いちばん伸びたのは木でした。',
      '土曜は写真だけでも回せます。'] },
    task: '投稿カレンダー作成', elapsed: '9分' },
  { id: 'e-dev', state: '実行中',
    line: '申込フォームの送信まわりを実装しています',
    steps: [['既存のフォームを読んだ', '34秒'], ['テストを4件 通した', '1分07秒'], ['submit.ts を書き換えている', '2分18秒']],
    body: { kind: 'code', file: 'src/form/submit.ts', foot: ['＋3行', 'テスト 4 / 4'], lines: [
      [31, 'const data = parseForm(await req.formData())', false],
      [32, 'const err  = validate(data, schema)', true],
      [33, 'if (err) return json({ ok: false, err }, 422)', true],
      [34, 'await db.signups.insert(data)', false],
      [35, 'return json({ ok: true }, 201)', true]] },
    task: '申込フォームの実装', elapsed: '21分' },
  { id: 'e-strategy', state: '要確認',
    line: '収益モデル比較レポートを出しました。見てください',
    steps: [['3案の損益を計算した', '56秒'], ['推奨の理由を書いた', '3分04秒']],
    body: { kind: 'review', title: '収益モデル比較 3案', when: '2時間前', action: '決める' },
    task: '収益モデル比較レポート', elapsed: '2時間' },
];

// ════════════════════════ ワークフロー ════════════════════════

export type FlowKind = 'done' | 'sel' | 'gate' | 'wait' | 'work';
export type FlowNode = { id: string; title: string; sub: string; kind: FlowKind };

/**
 * ワークフローの盤面。**色がつくのは判断待ちのノードだけ**（gate）。
 * 成果物の「要確認」は行の左の色帯で言っているので、ここでは面を塗らない。
 * 右の列は「次のフェーズ」（同じ Work）と「新しい Work」（枝分かれ）が横に並ぶ。
 */
export const FLOW = {
  /** 盤面の上に置く見出し。ノードではない */
  caption: '日本語学習サービス',
  chain: [
    { id: 'p1', title: '調査',           sub: 'フェーズ 1 · 完了',  kind: 'done' as const },
    { id: 'p2', title: '戦略',           sub: 'フェーズ 2 · 32%',   kind: 'sel'  as const },
    { id: 'd1', title: '収益モデル比較', sub: '成果物 · 要確認',    kind: 'done' as const },
    { id: 'g1', title: '価格モデル',     sub: '判断 · B案を推奨',   kind: 'gate' as const },
  ],
  /** 右の列。上から 新しい Work / 次のフェーズ / 新しい Work */
  right: [
    { id: 'b1', title: 'LPと申込フォーム',   sub: '新しい Work · 準備中', kind: 'work' as const, edge: '新しい Work' },
    { id: 'p3', title: 'プロダクト',         sub: 'フェーズ 3 · 待機',    kind: 'wait' as const, edge: '次のフェーズ' },
    { id: 'b2', title: 'SNS運用の立ち上げ',  sub: '新しい Work · 準備中', kind: 'work' as const, edge: '新しい Work' },
  ],
  /** 選択中のノードにぶら下がるサブポート */
  subs: ['担当 2', '成果物 1'],
};
