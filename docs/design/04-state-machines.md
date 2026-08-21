# 04 — 状態遷移

**画面の状態＝バックエンドの状態。** ここに書いていない状態は画面に出さない。
色は Phase 1 のデザイン言語に従う（青＝次に押すもの / 緑＝済・推奨 / 橙＝判断待ち / 赤＝停止）。

## Work

```mermaid
stateDiagram-v2
  [*] --> draft: ゴールを書く
  draft --> planning: 統括AIに渡す
  planning --> plan_review: 計画とメンバー案ができた
  plan_review --> planning: 直してほしい
  plan_review --> active: 承認
  active --> paused: 止める / 予算上限
  paused --> active: 再開
  active --> done: 全フェーズ完了
  done --> archived
  paused --> archived
  archived --> [*]
```

| 状態 | 画面 |
|---|---|
| `draft` | 下書き。灰 |
| `planning` | 統括AIが考え中。粒子アニメーション |
| `plan_review` | **橙**。ホームでも判断待ちに出る |
| `active` | 緑のドット（稼働中） |
| `paused` | 灰。理由を必ず添える |
| `done` | 緑 |

## フェーズ

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> active: 前フェーズが完了
  active --> review: このフェーズのタスクが全部 done
  review --> active: 差し戻し
  review --> done: 承認
  active --> skipped: 不要と判断
  done --> [*]
  skipped --> [*]
```

## タスク

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running: 社員が着手
  running --> needs_decision: 判断が要る
  running --> done: 完了
  running --> failed: 失敗
  needs_decision --> running: 決定が入った
  failed --> queued: 統括AIが組み直して1回だけ再試行
  failed --> blocked: 2回目の失敗
  blocked --> queued: あなたが方針を示した
  queued --> cancelled
  running --> cancelled
  done --> [*]
```

| 状態 | 表示 | 色帯（行の左3px） | 進捗 |
|---|---|---|---|
| `queued` | 待機 | `#2E2E2E` | — |
| `running` | 実行中 | 担当社員の色 | 実値 |
| `needs_decision` | 判断待ち | **橙** | 90〜95%で停止 |
| `blocked` | 停止 | **赤** | 現在値のまま |
| `done` | 完了 | 緑 | 100% |
| `failed` | （画面には出さず、再試行か blocked に遷移） | — | — |
| `cancelled` | 取消 | 灰・打ち消し | — |

**`needs_decision` からは、決定なしに絶対 `done` へ行かない。**

## 成果物

```mermaid
stateDiagram-v2
  [*] --> draft: 社員が作り始める
  draft --> review: 提出
  review --> approved: 承認
  review --> rejected: 差し戻し
  rejected --> draft: 直す
  approved --> superseded: 新しい版が承認された
  approved --> [*]
```

- 版は `version` を上げ、`lineage_id` で束ねる。**上書きしない**
- `approved` になって初めて、後続タスクの入力（`deliverable_inputs`）になれる
- 差し戻し理由は必ず残す（監査と、社員の学習の両方に効く）

## 決定事項

```mermaid
stateDiagram-v2
  [*] --> open: 統括AIが選択肢を出す
  open --> decided: あなたが選ぶ
  decided --> superseded: 決め直した
  decided --> [*]
```

- `decided` になった瞬間に、それを待っていたタスクが `queued` に戻る
- 決め直しは**新レコード**。前のものは `superseded` として台帳に残す
- 以降の全実行はこの決定を読む。読んだ記録は `decision_refs` に残る

## AI社員（employees）

```mermaid
stateDiagram-v2
  [*] --> proposed: 統括AIが提案
  proposed --> hired: 採用
  proposed --> declined: 見送り
  hired --> working: タスク実行中
  working --> hired: 実行終了
  hired --> paused: 一時停止
  paused --> hired: 再開
  hired --> released: 解雇
  released --> [*]
```

ホームの「稼働中 2 / 3」は `working` の数 / `hired` の数。

## 実行（runs）

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running
  running --> waiting_input: 道具の実行確認・判断待ち
  waiting_input --> running
  running --> succeeded
  running --> failed
  running --> budget_reached: 上限に達した
  budget_reached --> running: 上限を上げた
  running --> cancelled
```

`budget_reached` は**終了ではない**。実行の状態は run_steps に残ったまま止まる。
上限を上げれば続きから走る。画面には「トークン上限で停止中」と、増額ボタンを出す。

## 不変条件（再掲・実装時のチェックリスト）

- [ ] `needs_decision` のタスクは、対応する `decisions.status='decided'` なしに `done` へ遷移しない
- [ ] `approved` でない成果物は `deliverable_inputs` に入れられない
- [ ] `decisions` は UPDATE されない（状態遷移列を除く）
- [ ] すべての遷移が `audit_events` に1行残る
- [ ] `progress` はバックエンドの導出値だけが書き込む
- [ ] `credit_balance` は `credit_ledger` の合計と一致する
