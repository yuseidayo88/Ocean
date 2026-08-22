# ページの作り直し案（2026-08-23）

タスク・通知・メンバーが「中身は違うのに読み方が一種類しかない」問題への提案。
**まだ実装していない。** 承認をもらってから `app/(app)/` に入れる。

- キャンバス: https://claude.ai/code/artifact/3eaf00bf-57a2-4c85-a85f-cb76ab71d921
- `Main.dc.html` — 診断（なぜ3ページが同じ形に見えるか）と、直しかた4つ
- `Tasks.dc.html` — **いつやるか**で束ねる（今日 / あした / 今週のうち）＋判断待ちは行から出す
- `Inbox.dc.html` — 左に積み・右で片づける2列（読むものではなく片づけるもの）
- `Team.dc.html` — 表をやめて人を面に。**却下**（デスク・オフィス・成果物と重なる）

## メンバー 3案（2ページ目）

第1案が却下になった理由: 「いま何をしているか」はデスク、「誰がいるか」はオフィス、
「何ができたか」は成果物が持っている。カードの面はその3つの寄せ集めになっていた。

**メンバーだけが持てる軸は「この会社は何ができて、何ができないか」。**

- `MemberC.dc.html` — **調整卓。採用**
- `MemberA.dc.html` — 能力の表（行＝できること、列＝社員）。見送り
- `MemberB.dc.html` — これから要る力（先のフェーズ × いまの陣容）。見送り

### C案（採用）で決めたこと

**主役は「どんなAI社員なのか」。** 1人ぶんの帯に置くのは —

    ● 調査担当  Research  実行中          [Sonnet 5 ⌄]  [深さ ·  ·  ▮  ·  ·  · ]  [⚙]
    市場と競合を調べて、事実だけを積む
    [市場調査] [競合分析] [インタビュー設計] [＋]

- **「守ること」（ルール）は面に出さない。** 社員を選んだときの右ペインへ
- **「いま何をしているか」も出さない。** それはデスクの仕事（重複を避ける）
- **採用ページと同じ語り口に揃える。** 採る前と後で見え方が変わらない
- **モデルと思考の深さは同じ大きさ・同じ場所**（名前の行の右端、高さ 24px）。
  どちらも小さい操作なので、片方だけ大きく取らない
- **モデルは固定。深さはモデルを変えない。** 深さは「選んだモデルの中でどれだけ考えるか」
  （＝エフォート）。目盛りにモデル名を書くのはやめた
  → 実装では `tierFor(effort)` がモデルを選ぶのをやめる。モデルは社員の設定、深さは別
- **スキルとルールは歯車のアイコン**（行の右端 ＋ 全員に効くことの行）。
  `スキルとルールを設定 ›` の文字リンクはやめた。絵は `components/ui/Icon.tsx` の `gear` と同じ
- **説明文を置かない。** 見出しは1行、脚注は1行だけ

`MemberCMore.dc.html` — C案に足したいこと4つ ＋ 決めてほしい質問1つ

1. 並びは放っておけない順（要確認 → 実行中 → 待機）。待機は沈める
2. 一時停止を行の中へ（いちばん強い操作が、いちばん深いところにある）
3. 選んでいる社員を左3pxの色帯で示す（右ペインを開くので）
4. できることは3つまで、あとは ＋N（行の高さを社員ごとに変えない）
5. **決定**: 書いたものは**いつでも統括AIに届く**（A）。社員に直接は頼めない。
   統括AIが聞いて、誰にやらせるかを決める。
   → メンバー画面の入力欄も、ほかと同じ「統括AIに聞く」の1文にする
   （いまの「この社員に頼む、または統括AIに聞く」は消す）

実装に要る作業: 在籍社員（`EMPLOYEES`）にも `en` / `lead` / `can` を持たせる
（いまは採用候補 `HIRE_CANDIDATES` にしか無い）。

参考: StackAI Roles / Workable の権限表 / 15Five Competency（A案）

Mobbin で見た参考:
Todoist Upcoming / Attio Tasks / Evernote Tasks（期限で束ねる）·
Linear Inbox / Plane / Lemni（左一覧・右で片づける）·
ClickUp Team / Notion Team / Airtable Gallery（人は行ではなく面）

## 作り直しかた

```
SK=<design スキルの base directory>
node "$SK/seed-canvas.mjs" --template "$SK/payload.template.html" \
  --out onefound-page-redesign.html \
  --title "OneFound — 各ページの作り直し" \
  --artboard design/pages/Main.dc.html \
  --artboard design/pages/Tasks.dc.html \
  --artboard design/pages/Inbox.dc.html \
  --artboard design/pages/Team.dc.html \
  --artboard design/pages/MemberA.dc.html \
  --artboard design/pages/MemberB.dc.html \
  --artboard design/pages/MemberC.dc.html \
  --canvas design/pages/canvas.json
```

書き出した `.html` は 2MB あるので追跡しない（`.gitignore`）。
色・書体・角丸・行の高さ・状態の6語は現行のまま。**変えるのは並べ方だけ。**
