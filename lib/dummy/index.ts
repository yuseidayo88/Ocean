/**
 * Phase 4 のダミーデータ。**ここが唯一の出どころ**。
 * 画面ごとに数字を書かない（23枚の静止画で名簿がずれた反省）。
 *
 * 名簿は CLAUDE.md の決めごとに従う:
 *   在籍4人 = 調査担当 / 戦略担当 / 企画担当 / 開発担当
 *   執筆担当 = 統括AIの採用提案 / 品質担当・分析担当 = 採用ページの候補
 */

export type EmployeeColor = 'cyan' | 'purple' | 'indigo' | 'green';

export const AGENT_COLOR: Record<EmployeeColor, string> = {
  cyan: '#2AA9BF',
  purple: '#9A5CD0',
  indigo: '#5C6BC0',
  green: '#34A853',
};

/** 状態は6語だけ。この外に新しい言い方を作らない */
export type State = '判断待ち' | '要確認' | '実行中' | '待機' | '完了' | '承認済';

/** 遅れているかどうかは2語だけ */
export type Health = '順調' | { late: number };

// ════════════════════════ 会社 ════════════════════════

export const COMPANIES = [
  { id: 'kotonoha', name: 'ことのは', works: 3, current: true },
  { id: 'minamo', name: 'みなも', works: 1, current: false },
];

export const ME = { initial: 'Y', name: 'あなた' };

// ════════════════════════ AI社員 ════════════════════════

export type Employee = {
  id: string;
  name: string;
  role: string;
  color: EmployeeColor;
  state: State;
  now: string;
  load: number;   // 今週の稼働 0-100
  tasks: number;
  deliverables: number;
  since: string;
};

export const EMPLOYEES: Employee[] = [
  { id: 'e-research', name: '調査担当', role: '調査・競合分析', color: 'cyan',
    state: '実行中', now: '競合ポジショニング分析', load: 78, tasks: 4, deliverables: 5, since: '8月14日' },
  { id: 'e-strategy', name: '戦略担当', role: '収益設計・価格', color: 'purple',
    state: '要確認', now: '収益モデル比較レポート', load: 52, tasks: 3, deliverables: 2, since: '8月14日' },
  { id: 'e-dev',      name: '開発担当', role: '実装・テスト', color: 'green',
    state: '実行中', now: '申込フォームの実装', load: 64, tasks: 2, deliverables: 1, since: '8月17日' },
  { id: 'e-plan',     name: '企画担当', role: '要件・仕様', color: 'indigo',
    state: '実行中', now: '投稿カレンダー作成', load: 41, tasks: 4, deliverables: 2, since: '8月16日' },
];

export const employee = (id: string) => EMPLOYEES.find((e) => e.id === id)!;

/** 統括AIからの採用提案（1件だけ。無ければ提案の行そのものを出さない） */
export const HIRE_SUGGESTION = {
  id: 'c-writer',
  name: '執筆担当',
  reason: 'フェーズ3の記事とLPの文章を書ける社員がいません',
};

/** 採用ページの候補 */
export const HIRE_CANDIDATES = [
  { id: 'c-writer',  name: '執筆担当', en: 'Content Writer',   color: 'cyan' as EmployeeColor,
    lead: '調べたことを、読める文章にします。',
    can: ['記事', 'LPの文章', 'メール'], forWork: 'フェーズ3の記事とLP', recommended: true },
  { id: 'c-quality', name: '品質担当', en: 'QA Engineer',      color: 'indigo' as EmployeeColor,
    lead: '出す前に、壊れているところを見つけます。',
    can: ['動作確認', 'リンク切れ', '表記ゆれ'], forWork: '公開フェーズの前', recommended: false },
  { id: 'c-analyst', name: '分析担当', en: 'Data Analyst',     color: 'purple' as EmployeeColor,
    lead: '数字を見て、次に何を変えるかを言います。',
    can: ['アクセス解析', 'A/Bの設計', '週次レポート'], forWork: '公開したあと', recommended: false },
];

// ════════════════════════ Work ════════════════════════

export type Phase = {
  name: string;
  goal: string;
  state: 'done' | 'now' | 'next';
  /** 軸 0-100 上での開始と幅 */
  x: number; w: number;
  tasks: number;
  owner?: string;
};

export type Work = {
  id: string;
  title: string;
  goal: string;
  phaseIndex: number;
  progress: number;
  health: Health;
  state: State;
  restDays: number;
  phases: Phase[];
  /**
   * 担当。x = 進捗のレーンの日付軸上の位置、ring = オフィスの輪の上の位置（0-100）。
   * **別の座標系なので混ぜない**（レーンは日付、輪はその社員のタスクの進み）
   */
  crew: { id: string; x: number; ring: number; dim?: boolean }[];
  /** 判断待ちの ◆（軸上の位置） */
  gate?: { x: number; label: string };
  /** 遅れの帯 */
  over?: { x: number; w: number; label: string };
};

export const TODAY_X = 35.7;

/** 放っておけない順（遅れ → 判断待ち → 順調）。タスク一覧と同じ規則 */
export const WORKS: Work[] = [
  {
    id: 'w-sns',
    title: 'SNS運用の立ち上げ',
    goal: '毎週まわる投稿の型を作る',
    phaseIndex: 2, progress: 38, health: { late: 2 }, state: '実行中', restDays: 6,
    phases: [
      { name: '方針',   goal: '誰に何を出すかを決める', state: 'done', x: 1.8,  w: 12.5, tasks: 3, owner: 'e-plan' },
      { name: '運用設計', goal: '投稿の型と本数を決める', state: 'now',  x: 14.3, w: 14.3, tasks: 4, owner: 'e-plan' },
      { name: '実行',   goal: '4週ぶんを出しきる',     state: 'next', x: 35.7, w: 21.4, tasks: 5 },
    ],
    crew: [{ id: 'e-plan', x: 21, ring: 45 }],
    over: { x: 28.6, w: 7.1, label: '+2日' },
  },
  {
    id: 'w-japanese',
    title: '日本語学習サービス',
    goal: '韓国人向けの日本語学習サービスを立ち上げる',
    phaseIndex: 2, progress: 52, health: '順調', state: '判断待ち', restDays: 16,
    phases: [
      { name: '調査',     goal: '市場・競合・ターゲットを確かめる', state: 'done', x: 7.1,  w: 21.5, tasks: 5, owner: 'e-research' },
      { name: '設計',     goal: '収益モデルと価格を決める',       state: 'now',  x: 28.6, w: 28.5, tasks: 4, owner: 'e-strategy' },
      { name: '制作',     goal: 'MVPの要件を固めて作る',         state: 'next', x: 57.1, w: 21.5, tasks: 6 },
      { name: '公開',     goal: '初期ユーザーを集める',           state: 'next', x: 78.6, w: 14.3, tasks: 3 },
    ],
    crew: [{ id: 'e-research', x: 44, ring: 68 }, { id: 'e-strategy', x: 53, ring: 32, dim: true }],
    gate: { x: TODAY_X, label: '価格モデルの決定' },
  },
  {
    id: 'w-lp',
    title: 'LPと申込フォーム',
    goal: '問い合わせが来る状態にする',
    phaseIndex: 2, progress: 61, health: '順調', state: '実行中', restDays: 12,
    phases: [
      { name: '要件', goal: '載せることを決める',   state: 'done', x: 10.7, w: 17.9, tasks: 3, owner: 'e-plan' },
      { name: '制作', goal: '作って動かす',         state: 'now',  x: 28.6, w: 28.5, tasks: 4, owner: 'e-dev' },
      { name: '公開', goal: '出して計測する',       state: 'next', x: 57.1, w: 21.5, tasks: 2 },
    ],
    crew: [{ id: 'e-dev', x: 43, ring: 62 }],
  },
];

export const work = (id: string) => WORKS.find((w) => w.id === id)!;
export const DONE_WORKS = 2;

/** タイムラインの日付目盛り */
export const TICKS = [
  { x: 0, label: '8/11' }, { x: 25, label: '8/18' }, { x: 50, label: '8/25' },
  { x: 75, label: '9/1' }, { x: 100, label: '9/8' },
];

// ════════════════════════ タスク ════════════════════════

export type Task = {
  title: string;
  state: State;
  progress: number;
  owner: string | 'me';
  due: string;
  workId: string;
};

/** 放っておけない順（判断待ち → 実行中 → 待機 → 完了） */
export const TASKS: Task[] = [
  { title: '価格モデルの決定',        state: '判断待ち', progress: 90,  owner: 'me',         due: '8月21日', workId: 'w-japanese' },
  { title: '収益モデル比較レポート',  state: '要確認',   progress: 100, owner: 'e-strategy', due: '8月21日', workId: 'w-japanese' },
  { title: '競合ポジショニング分析',  state: '実行中',   progress: 62,  owner: 'e-research', due: '8月22日', workId: 'w-japanese' },
  { title: '申込フォームの実装',      state: '実行中',   progress: 45,  owner: 'e-dev',      due: '8月23日', workId: 'w-lp' },
  { title: '投稿カレンダー作成',      state: '実行中',   progress: 30,  owner: 'e-plan',     due: '8月24日', workId: 'w-sns' },
  { title: '競合1社の料金を調べる',   state: '実行中',   progress: 40,  owner: 'e-research', due: '8月21日', workId: 'w-japanese' },
  { title: 'LPのコピー',              state: '待機',     progress: 0,   owner: 'e-plan',     due: '8月26日', workId: 'w-lp' },
  { title: '公開前のチェック',        state: '待機',     progress: 0,   owner: 'e-dev',      due: '8月28日', workId: 'w-lp' },
  { title: '投稿の型を3案',           state: '待機',     progress: 0,   owner: 'e-plan',     due: '8月25日', workId: 'w-sns' },
  { title: '市場規模レポート',        state: '完了',     progress: 100, owner: 'e-research', due: '8月18日', workId: 'w-japanese' },
  { title: 'ペルソナ仮説 3パターン',  state: '完了',     progress: 100, owner: 'e-strategy', due: '8月19日', workId: 'w-japanese' },
  { title: '競合ポジショニング図',    state: '完了',     progress: 100, owner: 'e-research', due: '8月19日', workId: 'w-japanese' },
  { title: 'LPの見出しを3案',         state: '完了',     progress: 100, owner: 'e-plan',     due: '8月20日', workId: 'w-lp' },
  { title: 'SNSの方針を決める',       state: '完了',     progress: 100, owner: 'e-plan',     due: '8月17日', workId: 'w-sns' },
];

// ════════════════════════ 成果物 ════════════════════════

export type Deliverable = {
  id: string;
  title: string;
  by: string;
  when: string;
  state: State;
  workId: string;
  /** 一覧に出す実際の書き出し。灰色の棒は置かない */
  preview: string[];
};

export const DELIVERABLES: Deliverable[] = [
  { id: 'd-comp', title: '競合分析レポート v1.0', by: 'e-research', when: '2時間前', state: '要確認', workId: 'w-japanese',
    preview: ['韓国語話者向けの日本語学習は、既存3社が「文法中心」に寄っています。',
              '会話の練習まで面倒を見るサービスは、有料帯にほぼありません。',
              '価格は月 ¥1,200〜¥3,900 に集中。'] },
  { id: 'd-rev',  title: '収益モデル比較レポート', by: 'e-strategy', when: '4時間前', state: '要確認', workId: 'w-japanese',
    preview: ['月額 / 買い切り / 従量の3つを、初年度の粗利で比べました。',
              '月額 ¥1,980 が、解約率12%の前提でいちばん残ります。',
              '買い切りは初速が出ますが、2年目が続きません。'] },
  { id: 'd-mkt',  title: '市場規模レポート', by: 'e-research', when: '5時間前', state: '承認済', workId: 'w-japanese',
    preview: ['韓国の日本語学習者は約12万人（2025年・語学堂と民間の合算）。',
              'うちオンラインで学ぶ層は推計 3.4万人。',
              '出典3件。うち1件は推計を含みます。'] },
  { id: 'd-persona', title: 'ペルソナ仮説 3パターン', by: 'e-strategy', when: '1日前', state: '承認済', workId: 'w-japanese',
    preview: ['A: 就職のために N2 を取りたい 20代後半。急いでいる。',
              'B: 日本のドラマを字幕なしで見たい 30代。続かない。',
              'C: 出張が決まった会社員。3ヶ月しかない。'] },
  { id: 'd-pos',  title: '競合ポジショニング図', by: 'e-research', when: '1日前', state: '承認済', workId: 'w-japanese',
    preview: ['縦軸=価格、横軸=会話の比重で4象限に置きました。',
              '右上（高価格・会話重視）が空いています。'] },
  { id: 'd-head', title: 'LPの見出し 3案', by: 'e-plan', when: '2日前', state: '承認済', workId: 'w-lp',
    preview: ['A: 「3ヶ月後、字幕を消せる。」',
              'B: 「話せない日本語は、覚えていないのと同じ。」',
              'C: 「N2まで、迷わない道順で。」'] },
];

// ════════════════════════ 決定事項（追記のみの台帳）════════════════════════

export type Decision = {
  id: string;
  question: string;
  chosen?: string;
  rationale: string;
  when: string;
  workId: string;
  state: '判断待ち' | '承認済';
  options?: { key: string; label: string; note: string; recommended?: boolean }[];
};

export const DECISIONS: Decision[] = [
  { id: 'dec-price', question: '価格モデルをどうするか', when: 'いま', workId: 'w-japanese', state: '判断待ち',
    rationale: '競合3社の価格帯と、解約率の前提を並べました。',
    options: [
      { key: '1', label: '月額 ¥1,980', note: '解約率12%の前提で、初年度の粗利がいちばん残ります', recommended: true },
      { key: '2', label: '買い切り ¥19,800', note: '初速は出ますが、2年目の売上が続きません' },
      { key: '3', label: '従量（1レッスン ¥400）', note: '始めやすい代わりに、月の売上が読めません' },
    ] },
  { id: 'dec-target', question: '最初のターゲットを誰にするか', chosen: '就職のために N2 を取りたい 20代後半',
    when: '8月19日', workId: 'w-japanese', state: '承認済',
    rationale: '急いでいる層のほうが、お金を払う理由がはっきりしています。' },
  { id: 'dec-lang', question: 'サービスの表示言語', chosen: '韓国語と日本語の2つ',
    when: '8月18日', workId: 'w-japanese', state: '承認済',
    rationale: '学習者は日本語がまだ読めません。UIは韓国語が要ります。' },
  { id: 'dec-lp', question: 'LPを別の Work にするか', chosen: '別の Work にする',
    when: '8月17日', workId: 'w-lp', state: '承認済',
    rationale: 'LP単体でも問い合わせという価値が出るので、独立して追えます。' },
];

// ════════════════════════ 通知 ════════════════════════

export type Notice = {
  id: string;
  kind: '判断待ち' | '要確認' | '完了' | '採用' | '実行中';
  title: string;
  by: string;
  when: string;
  unread: boolean;
  children?: string[];
};

export const NOTICES: Notice[] = [
  { id: 'n1', kind: '判断待ち', title: '価格モデルの決定', by: '統括AI', when: '3時間前', unread: true },
  { id: 'n2', kind: '要確認', title: '競合分析レポート v1.0 ができました', by: '調査担当', when: '2時間前', unread: true },
  { id: 'n3', kind: '完了', title: '調査フェーズが終わりました', by: '統括AI', when: '昨日 18:40', unread: false,
    children: ['市場規模レポート', 'ペルソナ仮説 3パターン', '競合ポジショニング図'] },
  { id: 'n4', kind: '採用', title: '執筆担当の採用を提案しています', by: '統括AI', when: '昨日 15:10', unread: false },
  { id: 'n5', kind: '実行中', title: '申込フォームの実装をはじめました', by: '開発担当', when: '2日前', unread: false },
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

// ════════════════════════ 統括AIの状態（B群の宿題）════════════════════════

export type ExecState = 'idle' | 'thinking' | 'blocked';

export const EXEC_LINE: Record<ExecState, string> = {
  idle:     '待っています。やりたいことを書いてください。',
  thinking: '考えています',
  blocked:  '判断を待っています',
};
