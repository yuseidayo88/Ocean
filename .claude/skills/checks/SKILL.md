---
name: checks
description: OneFound の機械の検査を走らせる（E2E・レイアウト・行き止まり・押しても効かないもの）。「検査して」「機械で確かめて」「E2E を回して」「push する前に確かめて」のとき、そして**コードを触ったあとに必ず**読む。器の立て方（新しいポート・新しいサーバー・headless chrome）と、待ち方の作法が入っている。
---

# 検査を走らせる

**毎回やり直していたことを、ここに畳んである。** 前はセッションのたびに
器の立て方を思い出し直していて、間違えるたびに時間を落としていた。

## 決めごと（これを外すと嘘の結果が出る）

- **サーバーは毎回、新しいポートで新しく立てる。**
  メモリの保存先はプロセスの中にあるので、**前の検査のデータが残る**。
  同じポートで立て直しても、器が生きていれば古い会社が出てくる。
- **`sleep` でつながない。** 条件が立つまで待つ（下の書き方）。
- **`.next` が古いと、直したものが検査に出ない。** 触ったら必ず `npm run build`。
- **`DEMO_MODE=1`** で立てる（ログインを通さずに全画面が触れる）。
  **`.env*` には書かない** — OpenNext がビルド成果物に焼き込み、本番にも付いていく。

## 立てて、走らせる

```bash
sh tools/check/kill.sh                       # 立ちっぱなしの next を落とす
npm run build                                # 触ったなら必ず
PORT=3401                                    # 前回と違う番号にする
(setsid nohup env DEMO_MODE=1 npx next start -p $PORT > /tmp/srv$PORT.log 2>&1 < /dev/null &)
until curl -s -o /dev/null http://localhost:$PORT/login; do sleep 1; done
(setsid nohup env BASE=http://localhost:$PORT node tools/check/run.mjs 9335 > /tmp/e2e.log 2>&1 < /dev/null &)
```

**`setsid` を外さない。** 外すと、投げた側の shell が時間切れで落とされたときに
**プロセスの組ごと道連れ**になる。検査は途中の行まで書いて黙って死ぬので、
画面には「同じところで何分も止まっている」ように見える —
実際そう見えて、止まった先を1時間かけて調べたことがある。
生きているかは `ps -eo pid,args | grep '[c]heck/run.mjs'` で見る。

**待ち方**（前面で待つと時間切れで落ちる。背景に投げて、条件で待つ）:

```bash
until grep -q "EXIT=" /tmp/e2e.log 2>/dev/null; do sleep 25; done
grep -c "✓" /tmp/e2e.log; grep -n "✗" /tmp/e2e.log
```

## 検査は4つ

| | 何を見るか | かかる時間 |
|---|---|---|
| `run.mjs` | E2E。チャット → 計画 → 承認 → 実行 → 成果物 → 判断 → 完了 | 15〜20分 |
| `layout.mjs` | **空の会社**の18画面。切れる文字・画面外の文字がゼロか | 3分 |
| `reach.mjs` | 下まで送っても押せなくなるものが無いか | 5分 |
| `dead.mjs` | **押しても何も起きないもの**を数える（生◯◯ / 死12 が正常） | 10分 |

`reach` と `dead` は**種まきのあとに走らせる**（空の会社だと数が少なくて比べられない）:

```bash
BASE=http://localhost:$PORT node tools/check/_seed.mjs 9335 "韓国人向けの日本語学習サービスを立ち上げたい"
```

**`死 12` は正常。** 12枚の送信ボタンで、入力欄が空のときは押せなくて正しい。

**タブは検査が自分で閉じる**（2026-08-27 に入れた）。前は開きっぱなしで、
1日に10本回すと十数枚たまり、**どれもポンプと読み直しと粒の瞬きを回し続ける**ので
ブラウザが詰まった。残ってしまったときは:

```bash
curl -s http://127.0.0.1:9335/json/list | python3 -c "
import json,sys
print('\n'.join(t['id'] for t in json.load(sys.stdin) if t.get('url','')!='about:blank'))" \
| while read -r x; do curl -s "http://127.0.0.1:9335/json/close/$x" > /dev/null; done
```

## 通しで歩く（0 → 完了）

```bash
BASE=http://localhost:$PORT node tools/check/_walk.mjs 9335 "近所のパン屋のロゴを作りたい"
```

ゴールは引数で渡せる。**画面の実物が `/tmp/walk-*.png` に残る**ので、
「動いた」ではなく「何が出たか」を読む。

## headless chrome（CDP 9335）

起動フックが立てるが、**セッション中に落ちることがある**（実際1日に3回落ちた）。
`ECONNREFUSED 127.0.0.1:9335` が出たら立て直す:

```bash
(setsid nohup $(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell | head -1) \
  --no-sandbox --use-gl=swiftshader --enable-gpu-rasterization \
  --remote-debugging-port=9335 about:blank > /tmp/chrome.log 2>&1 < /dev/null &)
until curl -s -o /dev/null http://127.0.0.1:9335/json/version; do sleep 1; done
```

## この環境で出られない先

`openrouter.ai` はゲートウェイが **403（ポリシー拒否）**。鍵も無い。
つまり**アプリから本物のモデルは呼べない**（決め打ちのプロバイダで走る）。
`api.supabase.com` / `*.supabase.co` も同じ。**Supabase の MCP は通る**ので、
本番のデータを読む・直すのはそちらから。

モデルの出力そのものを確かめたいときは `probe-model` のスキルを読む。
