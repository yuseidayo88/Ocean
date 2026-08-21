# 01 — データモデル

前提: PostgreSQL（Supabase）。すべてのテーブルに `account_id` を持たせ、行レベルセキュリティ（RLS）で会社をまたげないようにする。

## 全体図

```mermaid
erDiagram
  accounts ||--o{ users : ""
  accounts ||--o{ works : ""
  accounts ||--o{ employees : ""
  accounts ||--o{ token_ledger : ""
  agent_definitions ||--o{ employees : "定義から採用"
  works ||--o{ phases : ""
  works ||--o{ tasks : ""
  works ||--o{ deliverables : ""
  works ||--o{ decisions : ""
  works ||--o{ hire_candidates : ""
  phases ||--o{ tasks : ""
  tasks ||--o{ runs : ""
  tasks ||--o{ deliverables : "生む"
  tasks ||--o{ task_deps : ""
  employees ||--o{ runs : ""
  runs ||--o{ run_steps : ""
  runs ||--o{ decision_refs : "参照した決定"
  decisions ||--o{ decision_refs : ""
  deliverables ||--o{ deliverable_inputs : "次の入力になる"
```

## テーブル

### 会社とユーザー

| テーブル | 主な列 | 備考 |
|---|---|---|
| `accounts` | `id, name, plan, token_balance, token_rate, created_at` | 1社＝1テナント |
| `users` | `id, account_id, email, display_name, role, created_at` | MVP は `role='founder'` のみ |

### Work（仕事のまとまり）

| 列 | 型 | 意味 |
|---|---|---|
| `id` | uuid | |
| `account_id` | uuid | |
| `title` | text | 「日本語学習サービス」 |
| `goal` | text | **自由文**。業種を列挙しない |
| `status` | text | `draft / planning / plan_review / active / paused / done / archived` |
| `current_phase_id` | uuid | null 可 |
| `budget_tokens` | int | この Work に使ってよい上限。null なら会社の残高まで |
| `kind` | text | `normal` / `inbox`（常設の「相談」。削除不可） |
| `origin_phase_id` | uuid | 昇格して切り出されたとき、元のフェーズ（→ [06](./06-work-and-scope.md)） |
| `created_at, started_at, done_at` | timestamptz | |

`phases`: `id, work_id, seq, name, goal, status, planned_tokens, promoted_to_work_id, started_at, done_at`
**フェーズ数は Work ごとに可変**。画面の「フェーズ 2 / 4」はこのレコード数から出す。

### タスク

| 列 | 型 | 意味 |
|---|---|---|
| `id, account_id, work_id, phase_id` | uuid | |
| `title` | text | |
| `intent` | text | 統括AIが社員に渡す依頼文（画面には出さない） |
| `status` | text | `queued / running / needs_decision / blocked / done / failed / cancelled` |
| `assignee_type` | text | `employee` / `user` |
| `assignee_employee_id` | uuid | `assignee_type='employee'` のとき |
| `progress` | int | 0–100。**導出値**。書き込むのはバックエンドだけ |
| `progress_basis` | text | `steps / checklist / binary / manual`。計算式を後から差し替えるための逃げ道 |
| `due_at` | timestamptz | |
| `created_by` | text | `executive` / `user` |

`task_deps`: `task_id, depends_on_task_id` — 受け渡しの順序。ホームのワークフロー図はここから描く。

### AI社員

| テーブル | 役割 |
|---|---|
| `agent_definitions` | **カタログ**。agency-agents 由来の定義（→ [03](./03-agent-schema.md)）。会社に依らない |
| `employees` | **採用したインスタンス**。`account_id, definition_id, display_name, color_token, model_tier, status, agent_id, agent_version, memory_store_id, hired_at` |

`employees.agent_id / agent_version` は Managed Agents 側の Agent を指す（→ [05](./05-tech-and-cost.md)）。
定義を更新すると版が上がるが、**走っている実行は採用時の版に固定**される。

### 実行の記録

| テーブル | 役割 |
|---|---|
| `runs` | 1タスク1回の実行。`task_id, employee_id, status, started_at, ended_at, cost_cents, tokens, resume_cursor, error` — `resume_cursor` は関数が時間切れで抜けたときの再開位置 |
| `run_steps` | `run_id, seq, kind(message/tool_use/tool_result/handoff), tool_name, summary, tokens_in, tokens_out, created_at` |

`run_steps` が**進捗率の根拠**。ホームの粒子アニメーションもこのストリームを購読して動かす。

### 成果物

| 列 | 意味 |
|---|---|
| `id, account_id, work_id, task_id` | |
| `title, kind` | `kind` は `doc / table / chart / link / file`。文字列なので後から増やせる |
| `version` | 1, 2, 3… 同じ `lineage_id` を共有 |
| `status` | `draft / review / approved / rejected / superseded` |
| `storage_path` | Supabase Storage のキー |
| `produced_by_employee_id` | |

`deliverable_inputs`: `deliverable_id, task_id` — **どの成果物がどのタスクの入力になったか**。
これが「社員から社員への受け渡し」の実体で、ホームのフロー図の線はこの表から引く。

### 決定事項

| 列 | 意味 |
|---|---|
| `id, account_id, work_id, task_id` | |
| `question` | 「価格モデルをどれにするか」 |
| `options` | jsonb: `[{key, label, value, pros, cons, recommended, proposed_by}]` |
| `chosen_option_key` | 決まるまで null |
| `rationale` | 決めた理由（任意） |
| `status` | `open / decided / superseded` |
| `supersedes_id` | 決め直したとき、前のレコードを指す |

**追記のみ。書き換えない。** 決め直しは新レコード＋`supersedes_id`。台帳画面はこの履歴をそのまま出す。

`decision_refs`: `decision_id, run_id` — **どの実行がどの決定を読んだか**。
「決めた内容は以降のAI社員が必ず参照する」を、口約束ではなく記録で担保する。

### 採用・通知・トークン・監査

| テーブル | 役割 |
|---|---|
| `hire_candidates` | `work_id, definition_id, reason, expected_tasks, estimated_credits, status(proposed/hired/declined)` |
| `notifications` | `kind, subject_type, subject_id, body, read_at` |
| `token_ledger` | `delta_tokens, reason(grant/consume/refund), work_id, run_id, balance_after` — **残高は台帳の合計から導出**。列を直接更新しない。内部は**セント単位の整数**で持ち、表示のときだけ `token_rate`（既定 1トークン = $0.00001）でトークンに直す |
| `audit_events` | `actor(user/executive/employee), verb, subject_type, subject_id, payload, created_at` — すべての状態遷移を残す |

## 不変条件

1. **進捗はどこからも直接書かれない。** `progress` は `run_steps` か `checklist` から導出した値だけを入れる。時間経過で進めない
2. **`token_balance` は `token_ledger` の合計と一致する。** ずれたら台帳が正
3. **`decisions` は UPDATE しない。** 状態遷移（open→decided）以外の書き換えは禁止
4. **タスクは `needs_decision` のあいだ、絶対に自動で先へ進まない**
5. **すべての状態遷移は `audit_events` に1行残る。** 画面に出ている状態は必ず根拠を辿れる
6. 業種・職種・フェーズ名を**コードに埋め込まない**
7. **`kind='inbox'` の Work は会社に必ず1つだけ存在し、削除できない**（→ [06](./06-work-and-scope.md)）
8. **Work は入れ子にしない。** 階層は Work → フェーズ → タスク の3段で固定

## 進捗率の出し方

```
progress_basis = 'steps'     → 完了した run_steps / 見積もりステップ数（上限95%。完了時のみ100）
progress_basis = 'checklist' → 完了したチェック項目 / 全項目
progress_basis = 'binary'    → 0 か 100
progress_basis = 'manual'    → 人が入れた値（例外用）
```

`needs_decision` のタスクは**作業自体は終わっている**ので 90–95% で止め、判断後に 100 にする。
画面（タスク表・ホームのリング）はこの値をそのまま表示する。**画面側で盛らない。**
