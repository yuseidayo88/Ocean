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
node tools/check/layout.mjs   9335 1440 800   # 幅ごとに全画面 × 開/閉
node tools/check/keyboard.mjs 9335            # Tab → Enter → Esc
node tools/check/rail.mjs     9335 1440 800 <url…>   # 左レールを閉じた状態
node tools/check/chat.mjs     9335                    # どの画面からでも統括AIと話せるか
node tools/check/cpu.mjs      9335 http://localhost:3300 /home /team
node tools/check/motion.mjs   9335 http://localhost:3300   # 出入りが動いているか
CPU=4 node tools/check/press.mjs 9335                     # 押してから右ペインが見えるまで
```

`BASE` で見に行く先を変えられる（既定 `http://localhost:3300`）。

## それぞれ何を見ているか

| | 見ているもの |
|---|---|
| `layout.mjs` | `…` で切れている文字 / 画面の外に出た文字 / **閉じたときと比べて消えた文字** / 横スクロール / コンソールのエラー。幅は `1440`（`SHELL_MIN`）· `1920` で回す |
| `keyboard.mjs` | 表の行に Tab でたどり着けるか、Enter で開いて URL に乗るか、Esc で閉じて URL からも消えるか、青い輪が出るか |
| `rail.mjs` | 左レールを閉じたときに中身が崩れないか。閉じているのに中のボタンが触れないか（`inert`） |
| `cpu.mjs` | **何もしていないとき**の CPU・レイアウト・スタイル再計算。`/home` は 5% 以下が目安 |
| `motion.mjs` | 右ペイン・左レール・入力欄が1フレームごとにどう動いたか（数字が段になっていれば動いている） |
| `press.mjs` | **押してから右ペインが見えるまで**（ページの中で計測）。`CPU=4` で遅い機械のふりをする |
| `reach.mjs` | **下まで送っても、入力欄に隠れて押せなくなるものが無いか。** 入力欄は中身の上に浮くので、下に貼り付く行は `COMPOSER_H` ぶん逃がす。`padding-bottom` では足りない（中身が短いとスクロールが起きず、行は動かない） |
| `dead.mjs` | **押しても何も起きないもの**を数える。押せる顔の要素を1つずつ押して、URL・中身・レールの幅・開いている板・フォーカスのどれも変わらなければ「死」。**1つ押すたびに読み直す**ので遅い（全画面で15〜20分）。履歴が要る 戻る/進む と、親に切り取られて押せないものは数えない |
| `chat.mjs` | どの画面でも入力欄に書いて Enter → 右ペインが会話になって開くか。**入力欄が1つのまま**ペインの中へ移るか |

**GPU を切らない。** `--disable-gpu` で立てた Chrome はソフトウェアで描くので、
オフィスの画面が 35fps に見える（実機は 60fps）。無い問題を追いかけることになるので、
`--use-gl=swiftshader --enable-gpu-rasterization` で立てる。

「消えた文字」は、閉じた状態にあって開いた状態に無い文字。
**器が潰れて中身が消える**のはこれで見つかる（1120px で `/tasks` の
タイトル列が 0px になっていたのを、これで見つけた）。

## 測る前に

**`next start` を kill するときは `pkill -f next-server`。**
プロセス名は `next start` ではなく `next-server (v16.3.2)` なので、
`pkill -f "next start"` では死なない。古いサーバーが残ったまま測ると、
直したはずのものが直っていないように見える（実際1回それで無駄にした）。

## dead.mjs の読み方

**数えた「死」をそのまま信じない。** これは選り分けの道具で、判定ではない。

- 見た目しか変わらないものは見えない。だから STATE に
  **URL / 中身のハッシュ / 節点の数 / レールの外枠の幅 / 開いている板 / フォーカス**を入れてある
- それでも **`/home` の数字は当てにならない**。盤面の絵が重く、
  読み込みが間に合わないまま測ることがある。ここだけは手で確かめる
- **押しても何も起きないのが正しいもの**もある —
  空のときの送信ボタン、いま開いているビューのピル、いま選んでいる行、
  すでに 100% のときの「100% に戻す」。これらは数に出るが直さない
