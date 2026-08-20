# Phase 0 — Design Discovery（デザイン方向性の検討）

一人社長向け「AIカンパニー」SaaS の Phase 0 デザイン成果物。コードは含まれません（実装は未着手・Phase制で進行中）。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `Main.dc.html` | 案A「Mission Control」— Nav rail｜Workspace｜Context Panel ＋ 下部 Executive Dock（指定構成・有力案） |
| `DirectionB.dc.html` | 案B「Command Deck」— 全幅Workspace ＋ フローティングExecutive Bar（⌘K）＋ Slide-over詳細 |
| `DirectionC.dc.html` | 案C「Flowline」— Phase → Gate（Exec Review / Decision）→ Phase のパイプライン可視化 |
| `States.dc.html` | 全案共通：Executive 3状態 / Context Panel 3状態 / New Work→Start Work 遷移 |
| `Cards.dc.html` | 全案共通：Question / Hiring / Decision / Review の各UIパターン |
| `canvas.json` | デザインキャンバスのレイアウト定義（配置・注釈） |

各 `.dc.html` は公開済みデザインキャンバスの1アートボードに対応します。キャンバス更新時はこのディレクトリのファイルを編集して再生成します。

## デザイントークン（暫定 — Phase 1 で確定）

- 背景: `#0B0E14`（near-black / blue-tinted charcoal）、ドットグリッド 24px
- 面: `rgba(255,255,255,0.03)` / 罫線: `rgba(148,163,184,0.10–0.16)`（thin borders）
- アクセント: `#6E9BFF`（blue）
- ステータス: Working `#6E9BFF` / Needs Review・Decision `#E8A33D` / Approved・Active `#3ED598` / Failed `#E5654F`
- 書体: IBM Plex Sans JP ＋ IBM Plex Mono（ラベル・数値）
- 角丸: カード 10px / 内側 8px / チップ・ボタン 6–7px / ピル 999px
