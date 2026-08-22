-- OneFound — 初期スキーマ
-- 出典: docs/design/01-data-model.md
--
-- 決めごと:
--   * 業種・職種・フェーズ名はコードにもスキーマにも埋め込まない（text で持つ）
--   * すべてのテナント表に account_id と RLS
--   * 進捗・残高は導出値。直接書かない（不変条件 1 / 2）
--   * decisions は追記のみ（不変条件 3）

create extension if not exists "pgcrypto";

-- ════════════════════════ 会社とユーザー ════════════════════════

create table accounts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  plan          text not null default 'trial',
  -- 会社の既定（社員ごとの上書きが無ければこれが効く）
  defaults      jsonb not null default '{"model_policy":"auto","effort_policy":"auto","task_token_cap":null}'::jsonb,
  -- 表示のときだけトークンに直すためのレート（1トークン = $0.00001）
  token_rate    numeric not null default 0.00001,
  created_at    timestamptz not null default now()
);

create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  account_id    uuid not null references accounts(id) on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null default 'founder',
  locale        text not null default 'ja',
  created_at    timestamptz not null default now()
);
create index on users (account_id);

-- ログイン中のユーザーの会社。RLS から呼ぶ
create or replace function current_account_id() returns uuid
language sql stable security definer set search_path = public as $$
  select account_id from users where id = auth.uid()
$$;

-- ════════════════════════ Work / フェーズ / タスク ════════════════════════

create table works (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references accounts(id) on delete cascade,
  title            text not null,
  goal             text not null,                       -- 自由文。業種を列挙しない
  status           text not null default 'draft'
                   check (status in ('draft','planning','plan_review','active','paused','done','archived')),
  current_phase_id uuid,
  budget_tokens    bigint,
  -- 昇格して切り出された元（不変条件 8: Work は入れ子にしない）
  origin_kind      text check (origin_kind in ('phase','errand')),
  origin_id        uuid,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  done_at          timestamptz
);
create index on works (account_id, status);

create table phases (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references accounts(id) on delete cascade,
  work_id             uuid not null references works(id) on delete cascade,
  seq                 int  not null,                    -- フェーズ数は Work ごとに可変
  name                text not null,
  goal                text,
  status              text not null default 'planned'
                      check (status in ('planned','active','done','skipped')),
  planned_tokens      bigint,
  promoted_to_work_id uuid references works(id) on delete set null,
  started_at          timestamptz,
  done_at             timestamptz,
  unique (work_id, seq)
);
create index on phases (account_id, work_id);
alter table works add constraint works_current_phase_fk
  foreign key (current_phase_id) references phases(id) on delete set null;

create table employees (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references accounts(id) on delete cascade,
  definition_id      text not null,                     -- agency-agents 由来のカタログ ID
  definition_version int  not null default 1,           -- 採用時の版に固定される
  display_name       text not null,                     -- 「調査担当」
  color_token        text not null,                     -- cyan / purple / indigo / green
  status             text not null default 'idle'
                     check (status in ('idle','running','paused','retired')),
  memory_store_id    text,
  hired_at           timestamptz not null default now()
);
create index on employees (account_id, status);

create table tasks (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references accounts(id) on delete cascade,
  work_id              uuid references works(id)  on delete cascade,
  phase_id             uuid references phases(id) on delete set null,
  kind                 text not null check (kind in ('work_task','errand')),
  title                text not null,
  intent               text,                            -- 社員に渡す依頼文。画面には出さない
  status               text not null default 'queued'
                       check (status in ('queued','running','needs_decision','blocked','done','failed','cancelled')),
  assignee_type        text not null default 'employee' check (assignee_type in ('employee','user')),
  assignee_employee_id uuid references employees(id) on delete set null,
  progress             int  not null default 0 check (progress between 0 and 100),  -- 導出値
  progress_basis       text not null default 'steps'
                       check (progress_basis in ('steps','checklist','binary','manual')),
  due_at               timestamptz,
  created_by           text not null default 'executive' check (created_by in ('executive','user')),
  created_at           timestamptz not null default now(),

  -- 不変条件 7: work_task は work_id を持ち、errand はどちらも null。中間を取らない
  constraint task_kind_shape check (
    (kind = 'work_task' and work_id is not null) or
    (kind = 'errand'    and work_id is null and phase_id is null)
  ),
  -- 担当が社員なら社員 ID が要る
  constraint task_assignee_shape check (
    (assignee_type = 'employee' and assignee_employee_id is not null) or
    (assignee_type = 'user'     and assignee_employee_id is null)
  )
);
create index on tasks (account_id, status);
create index on tasks (work_id);

create table task_deps (
  task_id            uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

-- ════════════════════════ AI社員の設定とスキル ════════════════════════

create table employee_settings (
  employee_id    uuid primary key references employees(id) on delete cascade,
  account_id     uuid not null references accounts(id) on delete cascade,
  rules          text[] not null default '{}',          -- 日本語で1行ずつ
  model_policy   text not null default 'auto' check (model_policy in ('auto','manual')),
  model_fixed    text check (model_fixed in ('fast','standard','deep')),
  effort_policy  text not null default 'auto' check (effort_policy in ('auto','manual')),
  effort_fixed   int  check (effort_fixed between 0 and 100),   -- スライダーの位置
  task_token_cap bigint,
  paused         boolean not null default false,
  updated_at     timestamptz not null default now()
);

create table agent_skills (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,  -- null = 会社ぜんぶのスキル
  filename    text not null,                            -- competitor-analysis.md
  name        text not null,                            -- 競合分析のやり方
  description text,                                     -- いつ読むか
  body        text not null,                            -- SKILL.md の中身
  source      text not null default 'user' check (source in ('builtin','user')),
  enabled     boolean not null default true,
  used_count  int not null default 0,
  created_at  timestamptz not null default now()
);
create index on agent_skills (account_id, employee_id);

-- ════════════════════════ 実行の記録 ════════════════════════

create table runs (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  task_id       uuid not null references tasks(id) on delete cascade,
  employee_id   uuid references employees(id) on delete set null,
  status        text not null default 'queued'
                check (status in ('queued','running','paused','done','failed','cancelled')),
  tier          text check (tier in ('fast','standard','deep')),
  tokens_in     bigint not null default 0,
  tokens_out    bigint not null default 0,
  cost_cents    bigint not null default 0,              -- 内部はセント単位の整数
  resume_cursor jsonb,                                  -- 時間切れで抜けたときの再開位置
  error         text,
  started_at    timestamptz,
  ended_at      timestamptz
);
create index on runs (account_id, task_id);

create table run_steps (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  run_id     uuid not null references runs(id) on delete cascade,
  seq        int  not null,
  kind       text not null check (kind in ('message','tool_use','tool_result','handoff')),
  tool_name  text,
  summary    text,                                      -- デスクのレーンに出す日本語1行
  tokens_in  int not null default 0,
  tokens_out int not null default 0,
  created_at timestamptz not null default now(),
  unique (run_id, seq)
);
create index on run_steps (account_id, run_id);

-- ════════════════════════ 成果物 ════════════════════════

create table deliverables (
  id                      uuid primary key default gen_random_uuid(),
  account_id              uuid not null references accounts(id) on delete cascade,
  work_id                 uuid references works(id) on delete cascade,
  task_id                 uuid references tasks(id) on delete set null,
  lineage_id              uuid not null default gen_random_uuid(),   -- 版をまたぐ同一物
  version                 int  not null default 1,
  title                   text not null,
  kind                    text not null,                -- doc / table / chart / link / file
  status                  text not null default 'draft'
                          check (status in ('draft','review','approved','rejected','superseded')),
  storage_path            text,
  preview                 text,                         -- 一覧に出す実際の書き出し2〜3行
  produced_by_employee_id uuid references employees(id) on delete set null,
  created_at              timestamptz not null default now(),
  unique (lineage_id, version)
);
create index on deliverables (account_id, status);

create table deliverable_inputs (
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  task_id        uuid not null references tasks(id) on delete cascade,
  primary key (deliverable_id, task_id)
);

-- ════════════════════════ 決定事項（追記のみ） ════════════════════════

create table decisions (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references accounts(id) on delete cascade,
  work_id           uuid references works(id) on delete cascade,
  task_id           uuid references tasks(id) on delete set null,
  question          text not null,
  options           jsonb not null default '[]'::jsonb, -- [{key,label,value,pros,cons,recommended,proposed_by}]
  chosen_option_key text,
  rationale         text,
  status            text not null default 'open' check (status in ('open','decided','superseded')),
  supersedes_id     uuid references decisions(id) on delete set null,
  created_at        timestamptz not null default now(),
  decided_at        timestamptz,
  check (status <> 'decided' or chosen_option_key is not null)
);
create index on decisions (account_id, status);

create table decision_refs (
  decision_id uuid not null references decisions(id) on delete cascade,
  run_id      uuid not null references runs(id) on delete cascade,
  primary key (decision_id, run_id)
);

-- 不変条件 3: decisions は書き換えない。open→decided と decided→superseded だけ許す
create or replace function decisions_append_only() returns trigger
language plpgsql as $$
begin
  if old.question is distinct from new.question
     or old.options  is distinct from new.options
     or old.work_id  is distinct from new.work_id
     or old.created_at is distinct from new.created_at then
    raise exception 'decisions は追記のみです。決め直しは新レコード＋supersedes_id で行ってください';
  end if;
  if not (
       (old.status = 'open'    and new.status in ('open','decided'))
    or (old.status = 'decided' and new.status in ('decided','superseded'))
    or (old.status = new.status)
  ) then
    raise exception '決定事項の状態遷移が不正です: % -> %', old.status, new.status;
  end if;
  return new;
end $$;
create trigger decisions_append_only before update on decisions
  for each row execute function decisions_append_only();
