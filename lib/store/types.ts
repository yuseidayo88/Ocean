import type { Effort } from '@/lib/ai/catalog';
import type { CandidateDraft, Conditions, Container, Fact, Finding, Hire, Plan, Question } from '@/lib/exec/types';

/** 承認を待っている Work 1件ぶん。画面（計画の承認）が読むのはこれだけ */
export type DraftWork = {
  id: string;
  title: string; goal: string;
  container: Container;
  questions: (Question & { answer?: string })[];
  hires: Hire[];
  plan: Plan;
  /** **本物のモデルが書いたのか、決め打ちか。** 画面に出す */
  real: boolean;
  /** 承認済みかどうか。承認したあとの計画画面は「承認済」と出して、もう押させない */
  approved?: boolean;
  createdAt: string;
};

/** 承認したあとの Work 1件ぶん。**Work 画面が読むのはこれだけ**（→ `lib/exec/work-view.ts`） */
export type LiveWork = {
  id: string;
  title: string; goal: string;
  status: 'plan_review' | 'active' | 'paused' | 'done' | 'archived';
  phases: {
    id: string; seq: number; name: string; goal: string;
    state: 'planned' | 'active' | 'review' | 'done' | 'skipped';
    /** 計画の週数（`plan_draft` から）。無い計画には無い — でっち上げない */
    weeks?: number;
    /**
     * **社長が承認した、このフェーズの担当**（`plan_draft` の `PlanPhase.owner`）。
     *
     * 前は計画の中にしか無く、**次のフェーズを引く統括AIには届いていなかった** —
     * 計画に「仕上げ = 開発担当」と書いて社長が承認したのに、
     * タスクを引くときは誰も知らないので、別の人に振られる（実際そうなった）。
     */
    owner?: string;
    /**
     * **いつ始まったか。** 見込み（`weeks`）と突き合わせて
     * 「見込みどおり / N日 かかった」を言うために要る（→ `lib/exec/finish.ts` の `paceSay`）
     */
    startedAt?: string;
  }[];
  tasks: {
    id: string; phaseId: string; title: string; intent: string; state: string;
    owner?: string;
    /** 進捗（0-100）。**run_steps から導出される値**で、アプリは直接書けない */
    progress?: number;
    /** 担当の定義 slug。実行のとき定義文を引くのに使う */
    ownerSlug?: string;
    ownerId?: string;
  }[];
  crew: { id: string; name: string; color: string }[];
  /**
   * **この Work で社長が決めたこと**（新しい順・最大6件。2026-08-26）。
   * Work 画面の右ペインの「決めたこと」は、ここが空だったので
   * **どの Work でも永久に「まだありません」**と出ていた（型にあるだけの節）。
   * 読みを1本増やさずに済むよう、`getWork` が同じ往復で取ってくる。
   */
  decs?: { question: string; chosen: string; when?: string }[];
  /**
   * **いま社長に聞いている、この Work の判断**（フェーズの ◆）。
   * タスクから上がる判断（`needs_decision`）はタスクの行に出るが、
   * これはフェーズの関門なので Work の帯に出す。無ければ undefined。
   */
  openDec?: LiveDecision;
  /** その Work の成果物（新しい順） */
  dels?: LiveDeliverable[];
  startedAt?: string;
};

export type LiveDeliverable = {
  id: string; title: string; kind: string; state: string;
  preview?: string; body?: string; by?: string; when?: string; taskId?: string;
  /** 版。同じ Work で同じタイトルの成果物は同じ lineage の新しい版になり、前の版は隠れる */
  version?: number;
  /** できた時刻（並びの出どころ。listDels は**新しい順**という契約を双子で守る） */
  at?: string;
};

/**
 * フェーズの関所。`closePhaseIfDone` が返す。
 *
 * - `closed` … このひと呼びで active → review に畳んだフェーズ名（通知を立てた側）
 * - `hold`  … review のフェーズが**社長を待っている**（◆ があるか、成果物が 要確認 のまま）
 * - `ready` … review のフェーズがあって、待つものが何も残っていない（次を引いていい）
 * - `at`    … いま review にいるフェーズ名（無ければ null）
 *
 * `hold` と `ready` は排他だが、review が1つも無ければ**どちらも false**。
 */
export type PhaseGate = { closed: string[]; hold: boolean; ready: boolean; at: string | null };

/** つないだ道具（MCP）。**鍵はここに置かない** → `lib/mcp/types.ts` */
export type { McpServer } from '@/lib/mcp/types';
import type { McpServer } from '@/lib/mcp/types';

/** 通知1件。通知の画面（片づける場所）が読む */
export type Note = {
  id: string; kind: string; body: string;
  at?: string; read?: boolean;
  subjectType?: string; subjectId?: string;
};

/** チャットのスレッドと発言。会話は**ここに一本化**する（Work は会話を持たない） */
export type ChatThread = {
  id: string; title: string; lastAt?: string;
  /** **1チャット = 1 Work。** 作ったらここに入り、二度は作らない */
  workId?: string;
  /** この会話で集めている条件 / 取り込んだ事業。**スレッドが覚える**（→ 0022） */
  discoveryId?: string;
  profileId?: string;
};

/**
 * 会話の中に出るカード。**右ペインは開かない** — 中身は会話の中で完結する。
 *
 * **カードは id しか持たない。** 中身（候補・診断）は描くときに store から読む。
 * 焼き込むと「もう採用した」「もう Work にした」が古いまま残る。
 */
export type ChatCard =
  | { kind: 'ask'; questions: Question[] }
  | { kind: 'candidates'; sessionId: string }
  | { kind: 'diagnosis'; profileId: string }
  | { kind: 'work'; title: string; goal: string; weeks: number; why: string };

export type ChatMsg = {
  role: 'user' | 'executive'; body: string; at?: string;
  card?: ChatCard;
};

/**
 * スキル（SKILL.md）1枚。employee_id が無ければ会社ぜんぶのスキル。
 * source: builtin＝元々の機能（見える・消せない・切れる）/ user＝社長が読み込んだ /
 * learned＝**社員が仕事から書き溜めた学び**（1人1枚。設定ペインに出す）
 */
export type SkillRow = {
  id: string; name: string; filename: string; on: boolean;
  scope: 'company' | 'employee'; used: number;
  /** builtin=標準 / user=社長が上げた / learned=学びの1枚 / agent=社員が書いた */
  source: 'builtin' | 'user' | 'learned' | 'agent';
  /** SKILL.md の中身。一覧では読まないこともある */
  body?: string;
  /** いつ読むか（1行）。社員が書いたスキルは必ず持つ */
  desc?: string;
  /** 誰のスキルか（null なら会社ぜんぶ）。**実行はこれを見て、その社員のぶんも読む** */
  employeeId?: string | null;
  /**
   * **通る前は読まれない**（2026-08-26 → `supabase/migrations/0029_agent_skills.sql`）。
   * 社員が書いたものは draft で生まれ、統括AIが見て active か rejected になる。
   * 社長が上げたものと標準スキルは、これまでどおり最初から active。
   */
  status: 'draft' | 'active' | 'rejected';
  /** 書いた社員（`employeeId` とは別 — 会社ぜんぶのスキルにも書き手がいる） */
  author?: string | null;
  /** 何回直されたか（Hermes の「使いながら良くなる」） */
  revision?: number;
  /** 統括AIが落とした理由。**残す** — 社長が読んで、戻せるように */
  note?: string;
  /** 直しの提案が待っている（いま効いている body はそのまま） */
  pending?: boolean;
};

/**
 * **思い出したもの**（Hermes の cross-session recall）。
 * 出どころは3つだけ — 作ったもの / 決めたこと / 会話。会社の記憶はこの3つに全部ある。
 */
export type Memo = {
  kind: '成果物' | '決めたこと' | '会話';
  title: string;
  snippet: string;
};

/** 統括AIが見るもの。新しいスキルか、いま効いているものへの直しか */
export type PendingSkill = {
  id: string; name: string; desc?: string;
  /** 新しいスキルなら 'new'、直しの提案なら 'edit' */
  kind: 'new' | 'edit';
  /** 'new' は本文、'edit' は直したい中身 */
  body: string;
  /** 'edit' のときだけ、いま効いている中身 */
  live?: string;
  /** 直しの理由（社員が書く） */
  why?: string;
  authorName?: string;
};

/**
 * **その社員が、どのモデルで、どれだけ考えるか。**
 * `employeeId` が null なら統括AI（employees に行を持たないので、スキルと同じ書き方）。
 * 未設定のところは既定（`DEFAULT_PREF`）で走る — 空は「まだ選んでいない」であって
 * 「何も無い」ではない。
 */
export type AgentPref = {
  employeeId: string | null; model?: string; effort?: Effort;
  /**
   * **一時停止しているか。** 止めているあいだ、その社員の新しいタスクは起こされない
   * （`nextQueued` が飛ばす）。走っている最中のものは最後までやる —
   * 途中で切ると、書きかけの成果物が宙に浮く。
   *
   * **`employees.status` には持たせない。** あの列は「いま何をしているか」で、
   * 実行のたびに running → idle と書き換わる（＝止めた印が次の実行で消える）。
   */
  paused?: boolean;
  /**
   * **会社が Web を見るか**（統括AIの行＝`employeeId` が null のときだけ意味がある。2026-08-26）。
   * 検索は従量で課金されるので**既定はオフ**。社長がメンバー画面から押す（→ `lib/ai/web.ts`）
   */
  web?: boolean;
};

/** 実行の1歩。デスクの工程の行と、タスクの右ペインに出る */
export type RunStep = {
  seq: number; kind: 'message' | 'tool_use' | 'tool_result' | 'handoff';
  tool?: string; summary?: string; progress?: number; at?: string;
};

/**
 * 書き込み先。**本番は Supabase、出られない環境ではメモリ。**
 * どちらも同じ形にして、呼ぶ側が分岐しないようにする。
 */
/**
 * 実行の失効。器の maxDuration は 300秒なので、10分を超えて running の実行は
 * もう帰ってこない（サーバーが入れ替わった）。回収しないとポンプが永久に止まる。
 */
export const STALL_MS = 10 * 60_000;

export interface Store {
  readonly kind: 'supabase' | 'memory';
  createDraft(d: Omit<DraftWork, 'id' | 'createdAt'>): Promise<string>;
  getDraft(id: string): Promise<DraftWork | null>;
  answer(id: string, index: number, answer: string): Promise<void>;

  /**
   * 承認して動かす（Phase 6）。**ここで初めて状態が進む。**
   * works → active / 最初のフェーズ → active / 提案した社員を採用。
   * タスクは `queued` のまま（走らせるのは Phase 7）。
   */
  approve(id: string): Promise<void>;
  /** 計画を引き直す。フェーズとタスクを入れ替え、控えも差し替える */
  revise(id: string, d: Omit<DraftWork, 'id' | 'createdAt'>): Promise<void>;
  /** 承認したあとの Work。**Work 画面が読む** */
  getWork(id: string): Promise<LiveWork | null>;

  /* ══════════════ 実行（Phase 7）══════════════
   * 進捗（tasks.progress）はここでは書かない。**run_steps から導出される**
   * （0012 の引き金）。書けるのは、歩みと成果物と状態だけ。
   */

  /**
   * タスクを走らせはじめる。task→running / 社員→running / runs に1行。
   * **取り合いはここで決める** — queued の1行を running に置き換えられた者だけが走る。
   * 置き換えられなければ conflict（別のポンプが先に取った。失敗ではない）
   */
  startRun(taskId: string): Promise<string>;
  /**
   * 止まったままの実行を回収する。サーバーが途中で入れ替わると finishRun が呼ばれず、
   * タスクが running のまま残って**ポンプが永久に止まる**（nextQueued が譲り続ける）。
   * 始まって10分を超えた running の実行は失効として閉じ、タスクを戻す —
   * はじめての失敗なら queued（もう一度だけ走る）、二度目は blocked ＋ エラー通知。
   * 実行は閉じたのにタスクだけ running で残った形（finishRun の途中で落ちた）は、
   * 実行の結果をタスクに写し終える。何か回収したら true
   */
  reclaimStalled(workId: string): Promise<boolean>;
  /** 1歩を記録する。進捗はここから導出される */
  addStep(runId: string, step: { seq: number; kind: RunStep['kind']; tool?: string; summary?: string; progress?: number }): Promise<void>;
  /** 実行を閉じる。done なら task→done・進捗100。失敗なら task→blocked に落とす */
  finishRun(runId: string, r: { status: 'done' | 'failed'; tokensIn: number; tokensOut: number; costCents: number; error?: string;
    /** 実際に使ったモデルの slug（ガバナンスの記録。鍵の無い環境は 'fake'） */
    model?: string }): Promise<void>;
  /** 成果物を書く。preview は本文の書き出し */
  /** 返り値は作った成果物の id（**品質担当がその場で差し戻す**ために要る。2026-08-26） */
  addDeliverable(d: { workId: string; taskId: string; employeeId?: string; title: string; kind: string; body: string }): Promise<string | null>;
  /** 通知を立てる（判断待ち / 要確認 / エラー） */
  addNotification(n: { kind: string; body: string; subjectType?: string; subjectId?: string }): Promise<void>;
  /** タスクの歩み（右ペインが読む） */
  getSteps(taskId: string): Promise<RunStep[]>;
  /**
   * **止まったタスクから戻る**（2026-08-26）。
   *
   * ここまで、実行が失敗した（`blocked`）タスクには**戻り道が1本も無かった**。
   * `closePhaseIfDone` は「そのフェーズのタスクが全部 done か cancelled」で閉じるので、
   * blocked が1つ残ると**そのフェーズは永久に閉じず、Work は二度と進まない**。
   * 通知は「途中で止まりました」と言うが、押した先の画面には行動が1つも無かった。
   *
   * モデルは失敗する。**失敗そのものは直せないが、失敗から戻れないのは直せる。**
   *
   * - `retryTask` — もう一度やる。`blocked` / `failed` のものだけ `queued` に戻す
   *   （二度押し・同時押しで、走っているタスクを積み直さない）
   * - `skipTask` — これは飛ばす。`cancelled` に落とす。
   *   フェーズの関門は cancelled を「済んだもの」として数えるので、**そこから先へ進む**
   * - `taskWhy` — 止まった理由（最後の実行の `error`）。**無ければ空**（でっち上げない）
   */
  retryTask(taskId: string): Promise<boolean>;
  skipTask(taskId: string): Promise<boolean>;
  taskWhy(taskId: string): Promise<string>;
  /**
   * **いま起こせる queued のタスクを、ぜんぶ**（2026-08-26。社長の
   * 「他のAIが全員動き出すみたいなかんじ」）。
   *
   * 前は1件だけ返し、しかも**走っているタスクが1つでもあれば null** だった —
   * 4人採用しても、動くのは常に1人。オフィスの絵に4人いるのに1人しか働いていなかった。
   *
   * いまは**走っている人のぶんだけ飛ばして、残りを全部返す**。
   * 取り合いは `startRun` の atomic な置き換えが捌くので、
   * 2つのポンプが同じタスクを拾っても、走るのは片方だけ。
   *
   * 飛ばすのは2つ — **止めた社員**（`agent_prefs.paused`）と、**担当のいないタスク**。
   */
  nextQueued(workId: string): Promise<{ taskId: string }[]>;
  /**
   * 社長の判断で止まる（失敗ではない）。task→needs_decision、
   * decisions に open の1行、判断待ちの通知（Phase 9 で答える側を作る）
   */
  markDecision(taskId: string, d: { question: string; why: string; options: unknown[] }): Promise<void>;

  /* ══════════════ レビューと承認（Phase 8）══════════════ */

  /** 会社の成果物ぜんぶ（新しい順）。成果物画面が読む */
  listDels(): Promise<(LiveDeliverable & { workId: string; workTitle: string })[]>;
  /**
   * 社長のレビュー。approved = 承認済 / rejected = 差し戻し。
   * **review のものだけ動く**（二度押し・同時押しで直しタスクが2つ積まれない）。
   * 動かせたら true
   */
  setDelStatus(delId: string, status: 'approved' | 'rejected'): Promise<boolean>;
  /** 差し戻しの直しタスク。同じ担当に、社長の言葉つきで積む（ポンプが走らせる） */
  addFixTask(workId: string, src: { taskId?: string; title: string }, note: string): Promise<void>;
  /**
   * フェーズのタスクが全部 done なら、フェーズを review にして通知を立てる。
   *
   * **社長を待つのは2つ** — 計画の ◆（`gates`＝社長でないと決められないところ）と、
   * **まだ見ていない成果物**。どちらも無いフェーズは会社が自分で進む。
   * 成果物ができたら社長が見て、承認がそのまま「進んでいい」の合図になる
   * （2026-08-25 の社長の指示。→ `docs/design/06-work-and-scope.md`）。
   *
   * review のフェーズは**閉じた直後でなくても毎回測り直す** —
   * 社長が最後の1件を承認した瞬間に `ready` が立ち、ポンプが次を引く。
   */
  closePhaseIfDone(workId: string, gates?: string[]): Promise<PhaseGate>;
  /**
   * 計画の ◆（`plan_draft` の gates）。**質問ごと返す。**
   *
   * 前は `afterPhase` だけを返していたので、**◆ に書いた質問はどこにも届かず**、
   * 計画に「あなたが決めるのは ◆ の1か所」と出しておきながら、
   * 社長は最後まで一度も聞かれなかった（決定事項も空のまま終わる）。
   */
  planGates(workId: string): Promise<{ afterPhase: string; question: string }[]>;

  /* ══════════════ 判断と受け渡し（Phase 9）══════════════ */

  /** そのタスクで開いている判断。無ければ null */
  getDecision(taskId: string): Promise<LiveDecision | null>;
  /**
   * 社長が決める。decisions → decided、タスク → queued に戻す
   * （ポンプが走らせ直す。次の実行は決めたことを文脈に持つ）
   */
  answerDecision(decisionId: string, chosen: string): Promise<void>;
  /** その Work の決めたこと（新しい順）。実行の文脈と決定事項画面が読む */
  /**
   * **もう決まっていることを台帳に残す**（社長がその場で選んだもの）。
   * タスクから上がってくる判断（`markDecision` → `answerDecision`）と違って、
   * これは最初から `decided`。いちばん最初の1件は「どの道で進めるか」で、
   * **選ばなかった道も一緒に残す** — なぜその道かは、選ばなかった道と並べて意味になる。
   */
  addDecided(workId: string, d: {
    question: string; chosen: string; why?: string;
    options: { label: string; description?: string }[];
  }): Promise<void>;
  /**
   * **計画の ◆ を、本物の判断にする**（2026-08-26）。
   *
   * `markDecision` はタスクに紐づくが、これは**フェーズの関門**なので Work に紐づく。
   * 開いているものが同じ Work にあれば **false**（同じ質問を二度立てない）。
   */
  addGateDecision(workId: string, d: {
    question: string; why: string;
    options: { label: string; description?: string; recommended?: boolean }[];
  }): Promise<boolean>;
  listDecisions(workId?: string): Promise<LiveDecision[]>;
  /** 実行が決定を読んだ記録（decision_refs）。**読んだのに記録が無い、を作らない** */
  addDecisionRefs(runId: string, decisionIds: string[]): Promise<void>;
  /**
   * review のフェーズを閉じて次へ。次のフェーズを active にし、渡されたタスクを積む。
   * 次が無ければ Work を done にする。返り値は次のフェーズ名（無ければ null）
   */
  advancePhase(workId: string, nextTasks: {
    title: string; intent: string; ownerHint?: string;
    /**
     * **そのタスクを始める前に、社長に決めてもらうこと**（2026-08-26。社長の
     * 「わからない部分は統括AIがユーザーに質問投げて他のAIが全員動き出す」）。
     *
     * あれば、そのタスクだけ `needs_decision` で待つ（判断待ちの通知が立つ）。
     * **ほかのタスクは動き出す** — 決まらないと進めないものだけが待つ。
     */
    ask?: { question: string; why: string; options: unknown[] };
  }[]): Promise<string | null>;

  /* ══════════════ 社員（Phase 10）══════════════ */

  /**
   * 採用する。**同じ定義の社員がいれば使い回す**（承認のときと同じ規則）。
   * 返り値は社員の id
   */
  hireEmployee(definitionId: string, displayName: string): Promise<string>;
  /** 在籍の一覧（メンバー画面が読む） */
  listEmployees(): Promise<LiveEmployee[]>;

  /* ══════════════ 課金の骨格（Phase 11）══════════════ */

  /** 残高（セント）。**null = 上限なし**（メモリ版のデモ。数字を偽装しない） */
  balanceCents(): Promise<number | null>;
  /** 台帳（新しい順）。請求・プラン画面だけが読む */
  /**
   * トークンの出入り。**数字を出していい唯一の画面**（`/billing`）が読む。
   * `workTitle` はどの Work のぶんか — 「AI社員の実行」だけが30行並ぶと、
   * どこにお金が行ったのか社長には読めない（台帳はあとから読むもの）。
   */
  ledger(): Promise<{ deltaCents: number; reason: string; when?: string; workTitle?: string }[]>;
  /** 枠に当たって止める。works → paused ＋ エラー通知 */
  pauseWork(workId: string, why: string): Promise<void>;
  /**
   * **社長が自分で止める / 再開する。**
   * 見ていないあいだも動く会社（1時間ごとの Cron）に、**止める手**が要る —
   * 気が変わった Work にお金を使い続けられるのは、社長には怖い。
   * 通知は出さない（自分でやったことを知らせ返さない）。動いたら true。
   */
  setWorkPaused(workId: string, paused: boolean): Promise<boolean>;
  /**
   * その時刻より後に**使ったぶん**（セント・正の数）。1日の上限を測るのに使う。
   * 台帳の実績だけを数える — 見積もりではない（→ `lib/run/budget.ts`）。
   * **null = 数えていない**（メモリ版のデモ。上限があるふりをしない）
   */
  spentSinceCents(iso: string): Promise<number | null>;
  /**
   * **その鍵で1通だけ**。同じ日に二度は出さない（朝の報告の `morning-` と同じ作法）。
   * 書けたら true。同時に来ても DB の一意 index が2通目を止める（0026）。
   */
  noticeOnce(key: string, kind: string, body: string): Promise<boolean>;
  /**
   * その鍵の通知がもう立っているか。**1往復を二度払わないための印**として読む —
   * 次のフェーズを引けなかったことは1通しか出さないので、その1通がそのまま
   * 「もう試した」の印になる（立てずに読むだけ）。
   */
  noticed(key: string): Promise<boolean>;
  /**
   * 動いている Work の id（active だけ・古い順）。
   * **会社ぜんぶを進めるポンプ**が回るのに使う。`listWorks` は1件ずつ組み立て直すので重い
   */
  activeWorks(): Promise<string[]>;

  /* ══════════════ ゼロ状態（画面はぜんぶここを読む。ダミーは無い）══════════════ */

  /** 会社の Work ぜんぶ（archived 以外・古い順）。ホーム4ビュー・一覧・タスクが読む */
  listWorks(): Promise<LiveWork[]>;
  /** 通知（新しい順）。通知の画面が読む */
  listNotes(): Promise<Note[]>;
  /** 通知を読んだことにする（開いたとき） */
  readNote(id: string): Promise<void>;
  /** チャット履歴（レール下段と会話画面） */
  listThreads(): Promise<ChatThread[]>;
  getThread(id: string): Promise<{ thread: ChatThread; messages: ChatMsg[] } | null>;
  /** 発言を書く。threadId が null なら新しいスレッドを作る。返り値はスレッド id */
  addChat(threadId: string | null, role: 'user' | 'executive', body: string, title?: string, card?: ChatCard): Promise<string>;
  /**
   * スレッドが覚えるもの（作った Work / 集めている条件 / 取り込んだ事業）を書く。
   * **workId は一度きり** — すでに入っていれば false を返して上書きしない（1チャット=1Work）
   */
  linkThread(threadId: string, patch: { workId?: string; discoveryId?: string; profileId?: string }): Promise<boolean>;
  /**
   * その Work の会話を引く（無ければ作る）。入力欄の宛先が「Work を選ぶ」になったので、
   * **選んだ先が必ず1本ある**ようにする。1チャット=1Work の裏返し
   */
  threadForWork(workId: string): Promise<string>;
  /**
   * スキル（SKILL.md）の一覧・有効の切り替え・追加・削除。
   * **1枚も無ければ標準スキル（builtin）を播く** — 元々の機能なので、どの会社にも最初からある
   */
  listSkills(): Promise<SkillRow[]>;

  /* ══════════════ つないだ道具（MCP・Phase 12）══════════════ */

  /** つないだ先の一覧。**鍵は返らない**（型に無い） */
  listMcpServers(): Promise<McpServer[]>;
  /**
   * つなぐ。**同じ行き先は二度つながない**（0028 の一意 index）。
   * 返すのは作った id。すでにあれば、その id（名前と鍵は上書きする）
   */
  addMcpServer(x: { name: string; url: string; token?: string }): Promise<string>;
  /** 使う・書ける・名前 を変える。触った列だけ */
  setMcpServer(id: string, patch: { on?: boolean; write?: boolean; name?: string }): Promise<void>;
  /** つなぐのをやめる */
  removeMcpServer(id: string): Promise<void>;
  /** 確かめた結果を書き戻す（道具の数か、繋がらなかった理由） */
  noteMcpCheck(id: string, r: { tools?: number; error?: string }): Promise<void>;
  /**
   * 相手に渡す鍵。**呼ぶときだけ、1本だけ**引く。
   * ここ以外から `token` を読まない（→ `supabase/migrations/0028_mcp_servers.sql`）
   */
  mcpSecret(id: string): Promise<string | undefined>;
  setSkill(id: string, on: boolean): Promise<void>;
  addSkill(s: { name: string; filename: string; body: string }): Promise<void>;
  /** 消せるのは user と agent のものだけ（標準は切れるが消せない。学びは setLearnings で） */
  removeSkill(id: string): Promise<void>;
  /**
   * **社長が中身を書き換える**（2026-08-26）。
   *
   * 画面には「新しく書く」があって、押すと**ひな形のファイルができる**のに、
   * ペインは読むだけだった — **書き込む場所がどこにも無かった**。
   * 設計（CLAUDE.md「行ごとに 有効トグル・⬇ダウンロード・✏編集・🗑削除」）の
   * ✏編集だけが、ずっと無いままだった。
   *
   * **直せるのは消せるものと同じ範囲**（`user` / `agent`）。
   * 標準スキルは切れるが消せない＝書き換えもできない（会社の土台）。
   * 社員が書いたものは**通ったあとでも社長が直せる** — 最後の決定権は社長にある。
   *
   * これは**社員の `proposeSkillEdit` とは別の道**。あちらは統括AIの審査を通るが、
   * 社長の直しは審査に掛けない（自分のファイルを自分で直すのに、許可は要らない）。
   */
  editSkill(id: string, body: string): Promise<boolean>;
  /** 読んだ印。実行の依頼文に載せたスキルの used_count を1つ進める */
  bumpSkillUse(ids: string[]): Promise<void>;

  /* ══════════════ 社員が自分でスキルを書く（Hermes の輪・2026-08-26）══════════════ */

  /**
   * **難しい仕事のあと、社員が手順書を書き残す。**
   * status='draft' で生まれる — **統括AIが通すまで、誰にも読まれない**。
   * 同じ filename がもうあるなら作らない（null を返す。直したいなら `proposeSkillEdit`）。
   */
  writeSkill(x: {
    employeeId: string | null; authorId?: string;
    name: string; filename: string; desc?: string; body: string;
  }): Promise<string | null>;
  /**
   * **使ってみて足りなかったところを直す。**
   * いま効いている本文は変えない（`draft_body` に置く）— 使えている手順書を、
   * 審査のあいだ止めない。
   */
  proposeSkillEdit(id: string, body: string, why: string, authorId?: string): Promise<void>;
  /**
   * **会社の記憶から探す**（2026-08-26 → `lib/exec/recall.ts`）。
   *
   * 探す先は 成果物 / 決めたこと / 会話 の3つ。`terms` のどれかが当たれば拾う。
   * **往復は増やさない** — 読む道具としてモデルに渡すのではなく、
   * こちらが先に引いて依頼文に載せる。`terms` が空なら何も返さない。
   */
  recall(terms: string[], limit?: number): Promise<Memo[]>;
  /** 統括AIの審査待ち（新しいスキルと、直しの提案）。無ければ空 */
  pendingSkills(): Promise<PendingSkill[]>;
  /**
   * 通す / 落とす。**直しの提案なら本文に当てる**（落とすと `draft_body` を捨てる）。
   * 落とした理由は残す — 社長が読んで、戻せるように。
   */
  reviewSkill(id: string, ok: boolean, note: string): Promise<void>;

  /* ══════════════ 学び（使うたびに賢くなる。ただしルールには自動で書かない）══════════════ */

  /** その社員の学び（1行ずつ・古い順）。実行の依頼文と設定ペインが読む */
  learnings(employeeId: string): Promise<string[]>;
  /** 実行の終わりに追記する。**上限30行** — あふれたら古いものから落とす */
  addLearnings(employeeId: string, lines: string[]): Promise<void>;
  /** 社長が消す・直す（丸ごと置き換え。空にしたら行ごと消える） */
  setLearnings(employeeId: string, lines: string[]): Promise<void>;
  /**
   * **社長が「毎回効かせたい」と決めた1行**（2026-08-26。学びからの昇格先）。
   *
   * 学びは30行の上限で回り、畳まれ、いつか薄まる。ルールは**残る**。
   * 画面には「ルールにするかは社長が決める」と前から書いてあったが、
   * **その操作がどこにも無かった** — ここがその置き場（`agent_skills` の `source='rule'`）。
   */
  rules(employeeId: string): Promise<string[]>;
  /** 丸ごと置き換え（空にしたら行ごと消える）。学びと同じ作法 */
  setRules(employeeId: string, lines: string[]): Promise<void>;

  /* ══════════════ 社長のこと（会社が覚える。2026-08-26）══════════════ */

  /**
   * **会社が覚えている社長のこと**（Hermes Agent の user modeling に当たる）。
   *
   * 学びが「社員が仕事から覚えたこと」なら、こちらは**会社が社長から覚えたこと** —
   * 何を選び、何を差し戻し、どれだけ時間が使えて、何を避けたいか。
   * 置き場は学びと同じ表（`agent_skills` の `source='learned'`）で、
   * **`employee_id` が null のほうが社長のぶん**（スキルと同じ書き方）。
   *
   * **モデルを呼んで作らない。** 決めた・差し戻した・条件を書いた、という
   * **起きた事実**をそのまま1行にする（朝の報告と同じ考え方）。
   */
  founderNotes(): Promise<string[]>;
  /** 追記。**同じことは二度書かない**。上限20行（学びより少ない — 人は1人しかいない） */
  addFounderNotes(lines: string[]): Promise<void>;
  /** 社長が消す・直す（丸ごと置き換え。空にしたら行ごと消える） */
  setFounderNotes(lines: string[]): Promise<void>;
  /* ══════════════ モデルと深さ（メンバー画面で社長が選ぶ）══════════════ */

  /** 全員ぶん（統括AIを含む）。メンバー画面が1回で取る */
  listPrefs(): Promise<AgentPref[]>;
  /** 1人ぶん。**実行の直前に読む** — 選んだものがその往復に効く */
  prefOf(employeeId: string | null): Promise<AgentPref | null>;
  /** 押したその場で効く（保存ボタンは無い）。渡した項目だけ書き換える */
  setPref(employeeId: string | null, patch: { model?: string; effort?: Effort; paused?: boolean; web?: boolean }): Promise<void>;

  /** 会社の名前（パンくずの根）。登録時はメールが入っている */
  companyName(): Promise<string>;
  /** 最近の歩み（オフィスのログ）。誰が・何をしたか、新しい順 */
  recentSteps(limit: number): Promise<{ at?: string; who: string; what: string }[]>;

  /* ══════════════ 入口（Case B / D）══════════════ */

  /** 探索を1つ始める（collecting）。返り値は id */
  createDiscovery(): Promise<string>;
  getDiscovery(id: string): Promise<Discovery | null>;
  /** 条件を丸ごと置き換える（統括AIが写した構造）。real も一緒に記録する */
  setConditions(id: string, c: Conditions, real: boolean): Promise<void>;
  /**
   * 候補の束を書く（status → proposed）。**前の束は消さない**（不変条件 9 —
   * 候補は消せない。DBの delete も revoke 済み）。画面が読むのは最新の1束
   */
  setCandidates(id: string, cands: CandidateDraft[]): Promise<void>;
  /** 候補を採用する（status → adopted、候補に Work を記す）。選ばなかった候補は残る */
  adoptCandidate(sessionId: string, candidateId: string, workId: string): Promise<void>;

  /** 既存事業のプロフィールを作る。返り値は id */
  createProfile(name: string): Promise<string>;
  getProfile(id: string): Promise<Profile | null>;
  /** 取り込んだものを1件足す。返り値は id */
  addSource(profileId: string, s: { kind: SourceRow['kind']; locator: string; summary?: string; status: SourceRow['status'] }): Promise<string>;
  /** 統括AIが読み取った名前・段階を写す */
  setProfileMeta(id: string, m: { name?: string; stage?: string }): Promise<void>;
  /** 診断を書く（1回ぶん）。画面が読むのは最新の1件 */
  saveDiagnosis(profileId: string, d: { facts: Fact[]; findings: Finding[]; real: boolean }): Promise<void>;
  /**
   * 見つかったことが Work になった、を書き戻す（候補の `adopted_work_id` と同じ役目）。
   * **もう立てたなら二度目は立てない** — 戻って押しても同じ Work が増えない。
   * 書けたら true（すでに別の Work が刺さっていたら false）
   */
  linkFinding(profileId: string, index: number, workId: string): Promise<boolean>;

  /* ══════════════ 朝の報告 ══════════════ */

  /**
   * 統括AIの朝の報告。**その日はじめて開いたとき、動きがあった朝だけ**1通。
   * チャットボットとの違いはここ — 聞かれる前に、会社のほうから言う。
   * 書いたら true（同じ日に二度書かない。一意性は 0015 の index がDB側でも守る）。
   * day は**社長の側の日付**（YYYY-MM-DD）。「その日」は社長の朝で数える — UTC ではない
   */
  morningBrief(day: string): Promise<boolean>;
}

/* ══════════════ 入口（Case B / D）══════════════ */

/** 探索の1回。条件は構造で、候補は**採用しなかったものも残す** */
export type Discovery = {
  id: string;
  status: 'collecting' | 'proposed' | 'adopted' | 'abandoned';
  conditions: Conditions;
  /** 最新の1束（3つ）。前の束もDBには残るが、画面が読むのはこれ */
  candidates: (CandidateDraft & { id: string; adoptedWorkId?: string })[];
  /** 本物のモデルが出したか。仮なら画面にそう出す */
  real: boolean;
};

/** 取り込んだもの1件 */
export type SourceRow = {
  id: string;
  kind: 'site' | 'doc' | 'sheet' | 'analytics' | 'social';
  locator: string;
  status: 'queued' | 'reading' | 'done' | 'failed';
  summary?: string;
};

/** 既存事業のプロフィール（診断つき）。取り込みと診断の画面が読む */
export type Profile = {
  id: string; name: string; url?: string; stage?: string;
  sources: SourceRow[];
  diagnosis?: { facts: Fact[]; findings: Finding[]; real: boolean; at?: string };
};

export type LiveEmployee = {
  id: string; definitionId: string; name: string; color: string;
  state: 'idle' | 'running' | 'paused' | 'retired';
  hiredAt?: string;
};

export type LiveDecision = {
  id: string; workId: string; taskId?: string;
  question: string; why?: string;
  options: { label: string; description?: string; recommended?: boolean }[];
  chosen?: string; status: 'open' | 'decided' | 'superseded';
  when?: string;
  /**
   * どの Work の判断か（`listDecisions` だけが埋める。2026-08-26）。
   * 台帳は会社ぜんぶを1本に並べるので、**Work の名前が無いとどの話か分からない** —
   * 「価格の方向性」だけでは、3本走っている会社では意味を成さない。
   */
  workTitle?: string;
};
