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

**いちばん上に統括AIを固定。** その下が AI社員。行の作りは同じ3段。

    ● 統括AI   Executive   実行中          [Claude Opus 4.5 Think… │ ····●· ⌄]  [⚌]
    あなたの言葉は全部ここに届きます。誰にやらせるかを決めます。
    できること  [Workを立てる] [計画を作る] [社員を選ぶ] +1

- **1行めは約束、3行めはできること。** 二度言わない。
  1行め＝その社員の癖（「数字には必ず出典を付けます」）、
  3行め＝頼めることの名前（「競合表を作る」）。前は両方が同じことを言っていた
- **「できること」は読むだけ。＋ は置かない。** 何ができるかは（a）社員の定義
  （b）読ませた SKILL.md で決まる。社長が文字で足すものではない
  （→ CLAUDE.md「道具は社長に触らせない」）。行に出すのは3つまで、あとは灰色の `+2`
- **スキルとルールは面に出さない。** つまみのアイコンの中（右ペイン＝AI社員の設定）
- **モデルと深さは1つの器**。`[ モデル名 │ ······ ⌄ ]`。
  横に別々の器を2つ並べると、対等な2つの設定に見えて、
  「深さはモデルの中の話」という入れ子が消えていた。押すと1枚の板に両方出る
- **モデル名が長くても崩れない**（150px で切って `…`）。器は右揃えなので左へ伸びる
- **要確認 は文字の右に書類のアイコン**。押すとその成果物へ飛ぶ。
  `見て決める` の橙のボタンは撤去（行の中でいちばん強い面になっていた）
- **歯車をやめた。** 丸に放射線8本は**明るさのアイコン**にしか見えない
  （`components/ui/Icon.tsx` の `gear` も同じ形で、15px ではただの太陽）。
  環＋歯も 15px では潰れて団子になるので、**つまみ（tune）**にした
- **押せるものの当たりは 26px の正方形・角丸8**。
  前は 26×24 で、絵の上下と左右の余白が違っていた。
  触れたら白3%・押したら5%の膜だけ。幅も高さも変えない

`MemberCMore.dc.html` — C案に足したいこと4つ ＋ 決めてほしい質問1つ

1. 並びは放っておけない順（要確認 → 実行中 → 待機）。待機は沈める
2. 一時停止を行の中へ（いちばん強い操作が、いちばん深いところにある）
3. 選んでいる社員を左3pxの色帯で示す（右ペインを開くので）
4. できることは行に3つまで、あとは灰色の `+2`（押せる顔にしない。全部は設定の中）
5. **決定**: 書いたものは**いつでも統括AIに届く**（A）。社員に直接は頼めない。
   統括AIが聞いて、誰にやらせるかを決める。
   → メンバー画面の入力欄も、ほかと同じ「統括AIに聞く」の1文にする
   （いまの「この社員に頼む、または統括AIに聞く」は消す）

実装に要る作業: 在籍社員（`EMPLOYEES`）にも `en` / `lead` / `can` を持たせる
（いまは採用候補 `HIRE_CANDIDATES` にしか無い）。統括AIは `EMPLOYEES` に入れず、
別の1件として最上段に置く（採用・解雇の対象にしないため）。
`components/ui/Icon.tsx` の `gear`（丸＋放射線8本）を `tune` に差し替える。

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
  --artboard design/pages/MemberCMore.dc.html \
  --canvas design/pages/canvas.json
```

書き出した `.html` は 2MB あるので追跡しない（`.gitignore`）。
色・書体・角丸・行の高さ・状態の6語は現行のまま。**変えるのは並べ方だけ。**
