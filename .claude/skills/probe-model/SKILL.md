---
name: probe-model
description: 本物のモデル（OpenRouter の MCP）に、OneFound の本物のプロンプトを通して**出てくる中身を判断する**。「実際どんなものが出るの」「質はどうなの」「テストして判断して」のときに読む。アプリからは openrouter.ai に出られないので、これが唯一「水」を見る方法。
---

# 出てくる中身を、本物のモデルで判断する

検査（`checks`）が確かめるのは**配管**で、**水**は見ていない。
成果物の質を判断したいときは、こちらを使う。

## なぜ回り道が要るか

アプリの実行時は `openrouter.ai` に出られない（ゲートウェイが 403・鍵も無い）。
**OpenRouter の MCP は通る**ので、そこから本物のモデルを叩く。
ただし **MCP は道具（tool_calls）を渡せない** — だから

> この環境では道具を呼べないので、`write_deliverable` に渡すはずの引数を
> `{"title": …, "kind": …, "body": …}` の **JSON だけ**で返してください。

と頼む。**プロンプトは本物のまま**にするのが肝心で、ここを要約すると測定にならない。

## 本物のプロンプトを取り出す

依頼文は実行時に組み立てられるので、**記憶で書かない**。`tsx` で本体から出す:

```bash
cat > /tmp/p.mts <<'TS'
import { personaOf, rosterBlock, ROSTER } from './lib/roster';
import { CONSTITUTION } from './lib/exec/constitution';
console.log(personaOf(process.argv[2], process.argv[3]));   // 社員の頭
TS
npx tsx /tmp/p.mts product-manager 企画担当
```

組み立ての順番は `lib/run/worker.ts` の `system` と `messages`（社員）、
`lib/exec/run.ts` の `shape()`（統括AI）を見る。

## どのモデルか

`lib/ai/tiers.ts` の `TIER_TABLE` が正。いまは
**fast / standard = `openai/gpt-5.6-luna`**、**deep = `openai/gpt-5.6-luna-pro`**。
深さの既定は 統括AI = `high` / 社員 = `low`（`DEFAULT_PREF`）。

**`reasoning_effort: high` は詰まりやすい。** 実測で、thinking だけで 9,140 トークン
使って**本文が空**、`max_tokens: 8000` では 60秒でも返らなかった。
測るときは `max_tokens` を 16000 まで上げるか、`low` で回す。

## 社長役は、自分でやる

**空欄のまま測らない。** 統括AI は計画の前に `ask` で聞いてくる（店名・客層・
使う場所・雰囲気など）。そこを黙って進めると、成果物は「情報をください」で終わり、
**製品が薄いのか測り方が悪いのか区別できなくなる**（実際そうなった）。

答えを入れると別物になる。実測（「近所のパン屋のロゴ」）:

| | 社長が黙っている | 4問答えた |
|---|---|---|
| 採用 | 7人 | 3人 |
| 前提 | 店名も客層も不明 | 印刷色数・納品形式・商標 |
| 成果物 | 「情報をください」 | デザイナーに渡せるブリーフ |

## 引き継ぎまで見る

1往復で終わらせない。**前の人の成果物を、次の人の依頼文にそのまま入れる**
（`lib/run/worker.ts` の「この Work でここまでに出来ているもの（…土台にする）」の形）。
前の成果物の中身が、次の受け入れ条件に変換されていれば引き継ぎは本物。

## 残高

`mcp__OpenRouter__get-credits` で見られる。1回の測定はおよそ $0.01〜0.02。
