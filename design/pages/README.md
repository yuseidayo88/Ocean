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

**いちばん上に統括AIを固定。** その下が AI社員。行の作りは同じ。

    ● 統括AI   Executive         実行中   [Opus 5 ⌄] [深さ · · · · ▮ ·] [⚙]
    あなたの言葉を全部受け取って、誰にやらせるかを決めます。
    スキル  [会社の言葉づかい] [判断の残し方]
    ────────────────────────────────────────────────
    ● 調査担当  Research Analyst  実行中   [Sonnet 5 ⌄] [深さ · · ▮ · · ·] [⚙]
    調べて、事実にして積みます。数字には必ず出典を付けます。
    スキル  [競合の調べ方] [市場規模の積み上げ] [インタビューの設計（点線＝外してある）]

- **統括AIも設定できる。** モデル・深さ・スキル・ルールは社員と同じ。
  違うのは、一時停止も解雇もできないこと（会社に1人しかいない）
- **「できること」の自由なタグと ＋ はやめた。** 何を＋するのか答えられなかった。
  AI社員にできることは（a）その社員の定義（b）読ませた SKILL.md の2つで決まり、
  社長が文字で足せるものではない（→ CLAUDE.md「道具は社長に触らせない」）
- **行に出すのは スキル。** 実際に読ませている SKILL.md の名前。点線＝トグルを外してあるもの。
  **足すのは歯車の中**（`.md` を上げる / 新しく書く）。行に ＋ は置かない
- **「守ること」（ルール）は面に出さない。** 歯車の中と、社員を選んだときの右ペインへ
- **「いま何をしているか」も出さない。** それはデスクの仕事（重複を避ける）
- **モデルと思考の深さは同じ大きさ・同じ場所**（名前の行の右端、高さ 24px）
- **モデルは固定。深さはモデルを変えない。** 深さは「選んだモデルの中でどれだけ考えるか」
  → 実装では `tierFor(effort)` がモデルを選ぶのをやめる。モデルは社員の設定、深さは別
- **説明文を置かない。** 見出しは1行、脚注は1行だけ

`MemberCMore.dc.html` — C案に足したいこと4つ ＋ 決めてほしい質問1つ

1. 並びは放っておけない順（要確認 → 実行中 → 待機）。待機は沈める
2. 一時停止を行の中へ（いちばん強い操作が、いちばん深いところにある）
3. 選んでいる社員を左3pxの色帯で示す（右ペインを開くので）
4. スキルは行に3つまで、あとは灰色の `+7`（押せる顔にしない。全部は歯車の中）
5. **決定**: 書いたものは**いつでも統括AIに届く**（A）。社員に直接は頼めない。
   統括AIが聞いて、誰にやらせるかを決める。
   → メンバー画面の入力欄も、ほかと同じ「統括AIに聞く」の1文にする
   （いまの「この社員に頼む、または統括AIに聞く」は消す）

実装に要る作業: 在籍社員（`EMPLOYEES`）にも `en` / `lead` / `skills` を持たせる
（いまは採用候補 `HIRE_CANDIDATES` にしか無い）。統括AIは `EMPLOYEES` に入れず、
別の1件として最上段に置く（採用・解雇の対象にしないため）。

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
