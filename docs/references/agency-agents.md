# 参考: agency-agents（AI社員定義のリファレンス）

- リポジトリ: https://github.com/msitarzewski/agency-agents
- ライセンス: MIT（Copyright (c) 2025 AgentLand Contributors）
- 確認日: 2026-08-21
- 位置づけ: **OneFound の「AI社員」定義フォーマットと初期ロスターの参考**。
  実装フェーズ（AI社員のスキーマ設計・シード投入）で必ず参照すること。

## 何があるか

294体 / 20カテゴリのエージェント定義（Markdown 1体 = 1ファイル）。

| カテゴリ | 体数 | | カテゴリ | 体数 |
|---|---:|---|---|---:|
| engineering | 58 | | gis | 13 |
| specialized | 57 | | security | 12 |
| marketing | 36 | | design | 10 |
| gis | 13 | | sales | 9 |
| testing | 9 | | paid-media | 7 |
| project-management | 7 | | academic | 6 |
| game-development | 6 | | spatial-computing | 6 |
| support | 6 | | finance | 5 |
| product | 5 | | healthcare | 3 |
| strategy | 3 | | integrations | 1 |

## 定義フォーマット

```yaml
---
name: UI Designer
description: Expert UI designer specializing in visual design systems, ...
color: purple
emoji: 🎨
vibe: Creates beautiful, consistent, accessible interfaces that feel just right.
---
```

本文の構成:

1. `# <Name> Agent Personality` — 一人称の宣言
2. `## 🧠 Your Identity & Memory` — Role / Personality / **Memory** / Experience
3. `## 🎯 Your Core Mission` — 見出しごとの責務と成果物、`**Default requirement**` で必須条件
4. `## 🚨 Critical Rules You Must Follow` — 禁止・必須事項

## OneFound へのマッピング（実装時の指針）

| agency-agents | OneFound |
|---|---|
| `name` / `description` | AI社員の名前・肩書き（採用画面に出す） |
| `color` | **社員の識別色**。UI全体でこの色だけで誰の仕事か分かる設計にしてある |
| `vibe` | 採用カードの1行紹介 |
| Identity & Memory | 社員プロフィール＋長期メモリの初期値 |
| Core Mission | 「できること」（スキル）と成果物の定義 |
| Critical Rules | 「仕事の進め方」（ルール）。統括AIが逸脱を検知する基準 |
| カテゴリ | 採用時の職種フィルタ |

### 注意点

- **emoji は取り込まない**。OneFound のUIは絵文字を使わない方針（アイコンはSVGか色のみ）。
- 定義は英語。**日本語UI向けに name / description / vibe / rules を翻訳**して持つ必要がある。
  原文は `source_locale: en` として別カラムに保持し、翻訳は上書きしない。
- 294体をそのまま出すと選べない。**Work の内容から統括AIが3〜5体に絞って提案する**のが
  OneFound の体験なので、全ロスターは検索・詳細画面にのみ置く。
- `color` の値は語（purple 等）。OneFound のトークン（シアン #3ECBE0 / パープル #B06CF5 /
  インディゴ #7C82F0 …）へのマッピング表を実装時に作ること。
- MIT なので再配布可。**出典表記を残す**（設定画面のクレジット、またはリポジトリのNOTICE）。
- 同作者に配布アプリ `agency-agents-app` あり。ロスター更新の追従方法を検討する余地がある。
