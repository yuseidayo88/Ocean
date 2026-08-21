# Ocean — Design Canvas（デザイン作業ファイル）

一人社長向け「AIカンパニー」SaaS のデザイン成果物。コードは含まれません（実装はPhase 3以降）。
各 `.dc.html` は公開済みデザインキャンバスの1アートボードに対応し、`canvas.json` が配置・ページ・注釈を定義します。

## 現在の状態

- **Phase 0（完了）**: 3つのDesign Directionを提示 → **案A「Mission Control」採用**
- **Phase 1（完了・承認待ち）**: 案Aを主要12画面＋Design Systemへ展開

## ファイル

### Phase 1 — 案A Mission Control（page-1）

| ファイル | 画面 |
| --- | --- |
| `NewWork.dc.html` | ① New Work — 目的入力（Executive中央ステージ・Case A〜D対応） |
| `PlanReview.dc.html` | ② Plan Review — Goal / Success Criteria / Team / Roadmap / First Tasks ＋ Start Work |
| `Office.dc.html` | ③ Office（会社の現在地）＋ Employee Detail パネル |
| `Main.dc.html` | ④ Work Detail — Overview（タブ・Roadmapレール・Tasks・Team・Deliverables） |
| `Roadmap.dc.html` | ⑤ Work Detail — Roadmap（Phase群・Decision Point・再計画）＋ Phase Detail パネル |
| `Tasks.dc.html` | ⑥ Tasks — 要対応ファースト ＋ Task Detail パネル |
| `Deliverables.dc.html` | ⑦ Deliverables — 一覧 ＋ Split プレビュー |
| `ExecutiveExpanded.dc.html` | ⑧ Executive — Expanded（Dock展開・ルーティング表示） |
| `ChatFocus.dc.html` | ⑨ Executive — Chat Focus（Work別履歴・検索・Phase Jump・Decision受領カード） |
| `Decision.dc.html` | ⑩ Decision Modal（推奨1つ・比較・Approved Decision保存） |
| `Review.dc.html` | ⑪ Deliverable Review — Focus（最大化・復帰動線） |
| `DesignSystem.dc.html` | ⑫ Design System（色・タイポ・余白・ボタン・状態・モーション・密度） |
| `States.dc.html` | 状態モデルと遷移（Executive 3状態 / Panel 3状態 / New Work遷移） |
| `Cards.dc.html` | 共通UIパターン（Question / Hiring / Decision / Review） |

### Phase 0 — アーカイブ（page-2）

| ファイル | 内容 |
| --- | --- |
| `DirectionB.dc.html` | 案B「Command Deck」（不採用・参考） |
| `DirectionC.dc.html` | 案C「Flowline」（不採用・参考） |

## Design Tokens（Phase 1確定 — 詳細は DesignSystem.dc.html）

- 背景 `#0B0E14` ／ Surface white 3–5% ／ Raised `#0E1219` ／ ドットグリッド 24px（Workspaceのみ）
- 罫線: slate 16%（強）/ 10%（標準）/ 6%（区切り）
- アクセント `#6E9BFF` — 「判断・実行中」のみ。**塗りのアクセントは1画面1箇所**
- Status: Working `#6E9BFF`（点滅ドット＝画面唯一のアニメーション）/ Needs Review・Decision `#E8A33D` / Approved `#3ED598` / Failed `#E5654F`
- 書体: IBM Plex Sans JP ＋ IBM Plex Mono（ラベル・数値・kbd）
- 角丸: 6 chip / 8 inner / 10 card / 12–14 modal / 999 pill、スペーシング 4px系
- ⌘J = Executive Dock、⌘K = コマンドパレット（統合しない）
- Motion: 120 / 200 / 280 / 400ms — 意味のある遷移のみ、Fake progress禁止、reduced-motion対応
