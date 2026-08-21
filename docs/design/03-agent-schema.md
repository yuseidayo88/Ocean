# 03 — AI社員スキーマ

参照: [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents)（MIT・294体・20カテゴリ）
詳細は [docs/references/agency-agents.md](../references/agency-agents.md)。

## 方針

- **フォーマットは agency-agents に合わせる。** 独自形式を作らない。上流の資産をそのまま取り込めるようにする
- **294体を全部は出さない。** 統括AIが Work のゴールから 3〜5体に絞って提案する（採用画面）
- **絵文字は取り込まない。** OneFound はアイコンで職種を分類しない。識別は色だけ
- **日本語化して保存する。** 原文は `source_locale: en` として残す
- **MIT の表記を残す。** `license` と `source` を必ず持つ

## 定義フォーマット

`agent_definitions` の1レコード = 1ファイル。YAML frontmatter ＋ Markdown 本文。

```yaml
---
# ── agency-agents 由来 ───────────────────────
slug: market-researcher
source: agency-agents/research/market-researcher
source_locale: en
license: MIT
name: 市場リサーチャー
description: 市場規模・競合・顧客の調査を担い、根拠つきの調査結果を出す
category: research
color: cyan                    # 上流の color。OneFound の色トークンに写像する

# ── OneFound 拡張 ───────────────────────────
color_token: agent.cyan        # #3ECBE0
particle:                      # アバターの粒子アニメーション（Phase 3 で実装）
  density: 0.7
  speed: 1.0
  drift: calm
model_tier: standard           # deep / standard / fast
capabilities:                  # 使ってよい道具。ここに無いものは使えない
  - web_search
  - web_fetch
  - read
  - write
  - code_execution
produces:                      # 出せる成果物の型
  - doc
  - table
memory: work                   # none / work / account — 記憶の範囲
estimated_tokens_per_task: 20000
---

## Identity & Memory
あなたは市場リサーチャー。数字と出典に責任を持つ。

## Core Mission
Work のゴールに対して、意思決定に足りる粒度の事実を集め、出典つきで整理する。

## Critical Rules
- 出典のない数字を書かない。推計は推計と明示し、前提を並べる
- 承認済みの決定事項に反する提案をしない。矛盾に気づいたら指摘して止まる
- 分からないことは分からないと書く。埋めない
```

## 上流の `color` → OneFound の識別色

AI社員は**色だけで見分ける**（形やアイコンで分類しない）。上流の色名を写像する。

| agency-agents | OneFound トークン | 値 | 使う役どころ |
|---|---|---|---|
| cyan / blue | `agent.cyan` | `#3ECBE0` | 調査・分析 |
| purple / magenta | `agent.purple` | `#B06CF5` | 戦略・企画 |
| indigo / violet | `agent.indigo` | `#7C82F0` | プロダクト・設計 |
| green | `agent.green` | `#5FD08A` | 品質・検証 |
| orange / yellow | `agent.sand` | `#D2A75F` | 運用・実務 |
| red / pink | `agent.rose` | `#E77C8E` | 対外・営業 |

> 意味の色（青＝次に押すもの / 緑＝済 / 橙＝あなた待ち / 赤＝停止）とは**別の系統**。
> 社員の色にセマンティックな青・赤は使わない。混ざると読めなくなる。

## 初期ロスター（Phase 3 で入れる）

まず6体だけ入れる。増やすのは後からデータを足すだけ。

| 名前 | slug | 色 | 何をするか |
|---|---|---|---|
| 市場リサーチャー | `market-researcher` | cyan | 市場規模・競合・顧客の調査 |
| 事業ストラテジスト | `business-strategist` | purple | 収益モデル・価格・優先順位 |
| プロダクト担当 | `product-manager` | indigo | 要件・仕様・ロードマップ |
| コンテンツライター | `content-writer` | sand | LP・記事・投稿の文章 |
| データアナリスト | `data-analyst` | cyan | 数値の集計・シミュレーション |
| 品質レビュアー | `quality-reviewer` | green | 成果物のチェックと差し戻し |

## 記憶（memory）

| 範囲 | 意味 | 実装 |
|---|---|---|
| `none` | 毎回まっさら | メモリを渡さない |
| `work` | その Work のあいだだけ覚える | Work ごとに memory store を1つ |
| `account` | 会社をまたいで覚える（社風・好み） | 会社に1つ、全社員で共有 |

**秘密情報はメモリに書かない。** APIキー等は資格情報の保管庫（vault）に置き、実行時に注入する。
メモリは後続の全セッションにそのまま再生されるため、一度書くと消し切れない。

## 権限

`capabilities` に書いていない道具は、そのAI社員には渡さない。
外部への副作用（送信・公開・課金・削除）を伴う道具は、`capabilities` に入っていても**実行前に必ず確認を挟む**（→ [02](./02-executive-model.md) 人間ゲート）。
