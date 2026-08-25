/**
 * ビューの形と UI の定数。**データは無い** — 画面が読むデータは store だけ
 * （→ `lib/store/`）。ここにあるのは、live のデータを画面の絵に変えるときの
 * 共通の型（アダプタ → `lib/live/`）と、会社に依らない名札（モデル名・深さの言葉）。
 */

import { agentColor, EXEC as EXEC_COLOR } from '@/lib/design/tokens';
import { EFFORT_WORD, modelOf, type Effort } from '@/lib/ai/catalog';
import { DEFAULT_PREF } from '@/lib/ai/tiers';


export type EmployeeColor = 'cyan' | 'purple' | 'indigo' | 'green';

/** 色の出どころは `lib/design/tokens.ts`。ここでは名前を付け直すだけ */
export const AGENT_COLOR: Record<EmployeeColor, string> = agentColor;

/** 状態は6語だけ。この外に新しい言い方を作らない */
export type State = '判断待ち' | '要確認' | '実行中' | '待機' | '完了' | '承認済';

/** 遅れているかどうかは2語だけ */
export type Health = '順調' | { late: number };

export const ME = { initial: 'Y', name: 'あなた' };

/** 出したものの見せ方。形が担当ごとに違うので、レールを見るだけで職種が分かる */
export type Produce =
  | { kind: 'squares'; n: number; filled: number; cap: string }   // 積まれる事実
  | { kind: 'lines'; cap: string }                                // 1文字ずつ伸びる文章
  | { kind: 'dots'; n: number; ok: number; cap: string }           // テストの目盛り
  | { kind: 'weeks'; n: number; done: number; cap: string }        // 週のマス
  | { kind: 'text'; cap: string };                                 // 統括AI（決めた件数）

export type Desk = {
  /** 経過。空なら出さない */
  el: string;
  /** run_steps を1本に畳んだもの */
  step: { done: number; all: number; name: string };
  produce: Produce;
  /** このあと積まれているタスク。0 なら出さない */
  wait: number;
};

/**
 * **設定を画面の言葉に。**（モデルと深さ → `lib/ai/catalog.ts`）
 *
 * まだ選んでいない人は**既定の姿**を出す。実行もその既定で走るので、
 * 画面と実物が食い違わない（「自動」のような、どこにも無い言葉を出さない）。
 */
export function prefWords(who: 'exec' | 'employee', p?: { model?: string; effort?: Effort }) {
  const def = DEFAULT_PREF[who];
  const model = p?.model ?? def.model;
  const effort = p?.effort ?? def.effort;
  const spec = modelOf(model);
  return { model, effort, label: spec?.label ?? model, word: EFFORT_WORD[effort], spec };
}

export type Phase = {
  name: string; goal: string; state: 'done' | 'now' | 'next';
  x: number; w: number;              // 進捗のタイムライン上の位置（軸 0-100）
  done: number; all: number;         // タスク
  from: string; to: string;          // 日付
  owner?: string;
};

/**
 * オフィスの輪。**1本の輪が1つの Work**、真上がはじまり、時計回り。
 *   弧の色 ＝ その区間をやった人。色が変わるところが引き継ぎ ＝ フェーズの境目。
 *   刻みは置かない（色の変わり目が境目なので、二度言うことになる）。
 */
export type Ring = {
  /** 0 から順に区切る。to までをその色の社員がやった */
  segs: { to: number; color: string }[];
  /** 弧の先端（Work の進み） */
  tip: number;
  /** 予定との差。tip からここまで赤い点線 */
  behind?: number;
  /** 名前を置く角度（輪の外側・左上） */
  labelDeg: number;
  /** 球の位置。**自分の区間のまん中に立つ。** 名前と色はここに埋める（画面で名簿を引かない） */
  crew: { id: string; at: number; gate?: boolean; name: string; color: string; run?: boolean }[];
};

export type Work = {
  id: string; title: string; goal: string;
  phaseIndex: number; progress: number; health: Health; state: State; restDays: number; endDate: string;
  phases: Phase[];
  /** x = 進捗レーンの日付軸上の位置 / ring = オフィスの輪の上の位置。**別の座標系** */
  crew: { id: string; x: number; ring: number; dim?: boolean; name: string; color: string }[];
  gate?: { x: number; label: string };
  over?: { x: number; w: number; label: string };
  ring: Ring;
};

/**
 * 今日の出来事。**引き継ぎもここに出る**（「◯◯ から △△ を受け取りました」）。
 * 右の列は高さが決まっていて縦にスクロールする。下端はグラデーションに溶かす。
 */
export type Event = { at: string; who: string; what: string; tone?: 'gate' | 'ok' | 'bad' };

export type Task = {
  /** 別の画面から `?open=` で名指しできるように、行にも id を持たせる */
  id: string;
  title: string; state: State; progress: number;
  owner: string | 'me'; due: string; workId: string; phase: string;
};

/** サムネイルは中身を出す。灰色の棒は置かない */
export type Preview =
  | { kind: 'text'; cap: string; lines: string[] }
  | { kind: 'table'; cap: string; rows: [string, string, string][]; hi: number }
  | { kind: 'bars'; cap: string; values: number[] };

export type Deliverable = {
  id: string; title: string; by: string; when: string; version: string;
  state: State | '生成中'; workId: string; preview: Preview;
};

/**
 * 右ペインに開いている成果物の中身。**タブは本物**なので、開いた1件ごとに中身が要る。
 * （タブは「持ち出して読み比べる文書」だけ。→ docs/design/08-panes.md）
 */
export type DeliverableBody = {
  lead: string;
  table: { head: string[]; rows: string[][]; hi: number; bars: number[] };
  conclusion: string;
};

export type DecOption = { label: string; value: string; note: string; pct: number; recommended?: boolean };

export type Decision = {
  id: string; question: string; when: string; workId: string;
  state: '判断待ち' | '承認済';
  options?: DecOption[];
  chosen?: string; basis?: string;
};

export type Notice = {
  id: string; kind: '判断待ち' | '要確認' | '実行中' | '承認済' | '完了';
  title: string; sub: string; when: string; unread: boolean;
  children?: [string, string][];
};

/**
 * 通知＝**読むものではなく片づけるもの**（参考: Linear Inbox / Plane Inbox / Lemni）。
 * 左に未処理を積み、右で中身を見て決める。片づけたら次の未処理へ。
 *
 * **これは状態の6語ではなく、通知の種類**。`エラー` は起きたことをそのまま言っているだけで、
 * タスクや Work の状態としては使わない。
 */
export type InboxKind = '判断待ち' | '要確認' | 'エラー';

export type InboxRow = { k: string; v: string; pct: number; note: string; hi?: boolean };

export type InboxItem = {
  id: string; kind: InboxKind; when: string; title: string; sub: string;
  /** 右の1行 — 誰が・いつ・どの Work のどこで */
  meta: string;
  /** 本文。1段落1文で書く */
  lead: string[];
  /** 案を比べるとき（判断待ち） */
  table?: { cols: [string, string, string, string]; rows: InboxRow[] };
  /** 見るものを並べるとき（要確認）。[名前, 担当] */
  look?: [string, string][];
  /** 片づけたあとに起きること。[こと, 誰] */
  after?: [string, string][];
  primary: string; secondary: string;
};

export type Thread = { id: string; title: string; unread?: boolean; workId?: string };

/**
 * 会話の中身。スレッドごとに違うものを持つ（3本が同じ会話だと履歴の意味がない）。
 * 質問（ask）は会話に流さず、入力欄の上の板として出す。無いスレッドもある。
 */
export type ChatBar = { k: string; v: string; note: string; pct: number; hi?: boolean };

export type Turn =
  | { who: 'you'; text: string }
  | { who: 'exec'; thought?: string; lead: string; bars?: ChatBar[]; steps?: [string, string][]; tail?: string };

export type ChatAsk = {
  q: string; idx: number; total: number; free: string;
  options: { label: string; note: string; recommended?: boolean }[];
};

export type Skill = {
  id: string; name: string; file: string; on: boolean;
  scope: 'employee' | 'company';
  /** 何回読まれたか。まだ一度も読まれていなければ空 */
  used: string;
};

export type ExecState = 'idle' | 'thinking' | 'blocked';

/** 中身の器は担当ではなく produces で決める（業種を埋め込まない） */
export type DeskBody =
  | { kind: 'facts'; cap: string; n: number; items: string[] }
  | { kind: 'text'; file: string; lines: string[] }
  | { kind: 'code'; file: string; lines: [number, string, boolean][]; foot: string[] }
  | { kind: 'review'; title: string; when: string; action: string };

export type Lane = {
  id: string; state: State; line: string;
  /** 誰のレーンか。名前と色はここに埋める */
  name: string; color: string; role?: string;
  steps: [string, string][];
  body: DeskBody;
  /** レーンの足もと。タスク名 ＋ 進み具合 ＋ かかった時間 */
  task: string; taskId: string; pct: number; elapsed: string;
};

/**
 * ワークフロー＝地図。**横に区切らない。** 鎖（Work）を格子の上に置いて、
 * 関係は直角に曲がる線で言う（地下鉄の路線図と同じ引き方）。
 *   ・鎖の中は横の線（次のフェーズ）／枝は縦の線（新しい Work・成果物）
 *   ・済んだフェーズが2つ以上続いたら1枚に畳む（フェーズ 1〜3 · 完了）
 *   ・列と段の番号だけ持つ。ピクセルは画面側が決める
 */
export type MapPhase = {
  name: string; kind: 'done' | 'now' | 'wait'; pct?: number;
  /**
   * **元のフェーズ番号**（畳んだ範囲）。畳むと列と番号がずれるので、番号のほうを持つ。
   * `[3, 3]` なら「フェーズ 3」、`[1, 3]` なら「フェーズ 1〜3」。
   */
  span?: [number, number];
};

export type MapWork = {
  id: string; title: string;
  /** 格子の位置 */
  col: number; row: number;
  status?: string; tone?: 'gate' | 'late';
  phases: MapPhase[];
  /** そのフェーズにいる社員（色。名簿は引かない） */
  crew: string[];
  /** この Work を生んだところ [親の id, 親のフェーズ番号(0始まり)] */
  from?: [string, number];
};

export type MapChip = {
  title: string; sub: string;
  col: number; row: number;
  /** ぶら下がる先 [Work の id, フェーズ番号] */
  owner: [string, number];
};

/**
 * 統括AI。**AI社員ではない**（採用も解雇もできない）。会社に1人。
 * ここにあるのは名札だけ — いま何をしているかは live から読む。
 */
export const EXEC = {
  id: 'exec', name: '統括AI', en: 'Executive', color: EXEC_COLOR,
  lead: 'あなたの言葉は全部ここに届きます。',
  can: ['Workを立てる', '計画を作る', '社員を選ぶ'], canMore: 1,
};

