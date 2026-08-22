# 機械で確かめる

見た目の話を「たぶん大丈夫」で終わらせないための道具。
Chrome を CDP でつないで、**開いた状態と閉じた状態の両方**を通す。

## 使いかた

```bash
# 1. 見せる側（本番と同じビルドで）
npm run build && DEMO_MODE=1 npx next start -p 3300

# 2. 見る側（ヘッドレスの Chrome を1つ立てておく）
/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell \
  --no-sandbox --disable-gpu --remote-debugging-port=9335 about:blank &

# 3. 走らせる（第1引数は CDP のポート）
node tools/check/layout.mjs   9335 1408 800   # 幅ごとに全画面 × 開/閉
node tools/check/keyboard.mjs 9335            # Tab → Enter → Esc
node tools/check/rail.mjs     9335 1408 800 <url…>   # 左レールを閉じた状態
node tools/check/cpu.mjs      9335 http://localhost:3300 /home /team
node tools/check/motion.mjs   9335 http://localhost:3300   # 出入りが動いているか
```

`BASE` で見に行く先を変えられる（既定 `http://localhost:3300`）。

## それぞれ何を見ているか

| | 見ているもの |
|---|---|
| `layout.mjs` | `…` で切れている文字 / 画面の外に出た文字 / **閉じたときと比べて消えた文字** / 横スクロール / コンソールのエラー。幅は `1408`（`SHELL_MIN`）· `1440` · `1920` で回す |
| `keyboard.mjs` | 表の行に Tab でたどり着けるか、Enter で開いて URL に乗るか、Esc で閉じて URL からも消えるか、青い輪が出るか |
| `rail.mjs` | 左レールを閉じたときに中身が崩れないか。閉じているのに中のボタンが触れないか（`inert`） |
| `cpu.mjs` | **何もしていないとき**の CPU・レイアウト・スタイル再計算。`/home` は 5% 以下が目安 |
| `motion.mjs` | 右ペイン・左レール・入力欄が1フレームごとにどう動いたか（数字が段になっていれば動いている） |

「消えた文字」は、閉じた状態にあって開いた状態に無い文字。
**器が潰れて中身が消える**のはこれで見つかる（1120px で `/tasks` の
タイトル列が 0px になっていたのを、これで見つけた）。
