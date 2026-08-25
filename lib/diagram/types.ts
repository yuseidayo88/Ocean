/**
 * ワークフロー図の形（→ `docs/design/11-diagram.md`）。
 *
 * **archify の IR をそのまま写している**（https://github.com/tt-a1i/archify · MIT）。
 * 社長が「この skill を適用したい」と指したもの。ただし **archify 本体は動かせない** —
 * あちらは `archify.mjs validate / deliver / visual-check` という Node の CLI が前提で、
 * OneFound の AI社員は**1タスク＝1往復・道具4つ**、シェルもファイルシステムも無い。
 *
 * だから**持ち込むのは「形」と「作法」**にした:
 *   ・器（`schema_version` / `diagram_type` / `meta` / `lanes` / `phases` /
 *     `mainPath` / `nodes` / `edges`）は**名前ごと同じ**
 *   ・検証は OneFound の中で回す（→ `check.ts`。CLI が要らない）
 *   ・描くのは**この会社のデザイン言語**（格子・直角の線・左3pxの色帯）
 *
 * **落としたもの**と、その理由:
 *   ・`brand` / `visual_preset` / `animation` / `cards` / `views` — 飾り。
 *     「面と枠を持てるのは押せるものだけ」「操作説明のコピーを置かない」に反する
 *   ・`legend` — **凡例を置かない**（凡例が要るなら、形のほうが間違っている）
 *   ・`groups` — レーンとフェーズで足りる（**入れ子は1段まで**）
 *   ・`width` / `height` / `yOffset` / `route` / `via` / `channelX` … —
 *     archify の描画器を手で操るための値。こちらは格子が位置を決めるので要らない
 *
 * **変えたもの**: `node.type`。archify は `frontend / backend / database …`
 * （システム構成の語）だが、一人社長のワークフローでは意味を持たない。
 * **この会社の6語**に寄せる（→ CLAUDE.md「言葉は短く、全画面で同じ語を使う」）。
 */

/** ノードの種類。**語彙を増やさない** — 判断＝あなたが決める、は全画面で同じ意味 */
export type NodeType = 'work' | 'decision' | 'deliverable' | 'wait' | 'end';

export type DiagramLane = {
  id: string;
  label: string;
  /** `exception` は例外の道（点線で沈める） */
  variant?: 'normal' | 'exception';
};

/** 区間の帯（列の範囲に名前を付ける）。フェーズの名前をそのまま使える */
export type DiagramPhase = { id: string; label: string; fromCol: number; toCol: number };

export type DiagramNode = {
  id: string;
  /** どのレーンか（`lanes[].id`） */
  lane: string;
  /** 何列目か（0 から。**格子が位置を決める**ので、座標は書かない） */
  col: number;
  type: NodeType;
  label: string;
  /** 1行だけの補足。無くてよい */
  sublabel?: string;
};

/** 辺の役目。**主線は1本**（archify の作法） */
export type EdgeRole = 'main' | 'branch' | 'async' | 'return' | 'error';

export type DiagramEdge = {
  id?: string;
  from: string;
  to: string;
  /** 線の上の小さい文字。ピルにしない */
  label?: string;
  role?: EdgeRole;
};

export type Workflow = {
  schema_version: 1;
  diagram_type: 'workflow';
  meta: { title: string; subtitle?: string };
  lanes: DiagramLane[];
  phases?: DiagramPhase[];
  /** 主線。**2つ以上**、順に辺で繋がっていること */
  mainPath: string[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

/** 主要ノードの上限（archify の作法: 12まで）。多いと読めない */
export const MAX_NODES = 12;
