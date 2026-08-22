-- 入口（Case B / D）・チャット・質問・採用・通知・台帳・監査

-- ════════════════════════ 入口 — まだ決まっていない人 ════════════════════════

create table discovery_sessions (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  status      text not null default 'collecting'
              check (status in ('collecting','proposed','adopted','abandoned')),
  -- 構造で持つ。自由記述にすると条件を1つ変えて出し直せなくなる
  constraints jsonb not null default '{"hours_per_week":null,"budget_jpy":null,"strengths":[],"avoid":[],"deadline":null}'::jsonb,
  created_at  timestamptz not null default now()
);
create index on discovery_sessions (account_id);

create table discovery_candidates (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  session_id      uuid not null references discovery_sessions(id) on delete cascade,
  name            text not null,
  summary         text not null,
  -- speed / cost / strength の3スコア。画面では棒で並べる
  fit             jsonb not null default '{"speed":0,"cost":0,"strength":0}'::jsonb,
  recommended     boolean not null default false,
  not_chosen_why  text,                                  -- 選ばなかった理由も残す
  adopted_work_id uuid references works(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on discovery_candidates (account_id, session_id);
-- 不変条件 9: 候補は消さない
create rule discovery_candidates_no_delete as
  on delete to discovery_candidates do instead nothing;

-- ════════════════════════ 入口 — すでに事業がある人 ════════════════════════

create table business_profiles (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name       text not null,
  url        text,
  stage      text,
  created_at timestamptz not null default now()
);
create index on business_profiles (account_id);

create table imported_sources (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references accounts(id) on delete cascade,
  business_profile_id uuid not null references business_profiles(id) on delete cascade,
  kind                text not null check (kind in ('site','doc','sheet','analytics','social')),
  locator             text not null,                     -- URL かストレージキー
  status              text not null default 'queued'
                      check (status in ('queued','reading','done','failed')),
  summary             text,
  created_at          timestamptz not null default now()
);
create index on imported_sources (account_id, business_profile_id);

create table diagnoses (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references accounts(id) on delete cascade,
  business_profile_id uuid not null references business_profiles(id) on delete cascade,
  -- [{kind, severity, title, evidence[], suggested_work}]
  -- 診断は必ず「次に何をするか」まで持つ
  findings            jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now()
);
create index on diagnoses (account_id, business_profile_id);

-- ════════════════════════ チャット（会話は1か所） ════════════════════════

create table chat_threads (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts(id) on delete cascade,
  title           text not null,
  work_id         uuid references works(id) on delete set null,  -- 任意。Work に紐づく相談
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index on chat_threads (account_id, last_message_at desc);

create table chat_messages (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  thread_id  uuid not null references chat_threads(id) on delete cascade,
  role       text not null check (role in ('user','executive')),
  body       text not null,
  refs       jsonb not null default '[]'::jsonb,          -- 参照した成果物・決定
  created_at timestamptz not null default now()
);
create index on chat_messages (account_id, thread_id, created_at);

-- ════════════════════════ 質問（入力欄の上に出る板） ════════════════════════

create table questions (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references accounts(id) on delete cascade,
  thread_id             uuid not null references chat_threads(id) on delete cascade,
  work_id               uuid references works(id) on delete cascade,
  task_id               uuid references tasks(id) on delete set null,
  body                  text not null,
  why                   text not null,                    -- 理由のない質問は出さない
  -- [{label, description, recommended}] — label だけの配列にしない
  options               jsonb not null default '[]'::jsonb,
  answer                text,
  answered_at           timestamptz,
  -- 不変条件 10: 質問は台帳に出さない。昇格したものだけが decisions に載る
  promoted_decision_id  uuid references decisions(id) on delete set null,
  created_at            timestamptz not null default now()
);
create index on questions (account_id, thread_id);

-- ════════════════════════ 採用・通知・台帳・監査 ════════════════════════

create table hire_candidates (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references accounts(id) on delete cascade,
  work_id        uuid references works(id) on delete cascade,
  definition_id  text not null,
  reason         text not null,                           -- なぜいま要るか
  expected_tasks int,
  status         text not null default 'proposed'
                 check (status in ('proposed','hired','declined')),
  hired_employee_id uuid references employees(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on hire_candidates (account_id, status);

create table notifications (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  kind         text not null,
  subject_type text,
  subject_id   uuid,
  body         text not null,
  -- まとめて届くものは1件にして中身をぶら下げる
  group_key    text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index on notifications (account_id, created_at desc);

-- 不変条件 2: 残高は台帳の合計から導出する。列を直接更新しない
create table token_ledger (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  delta_cents   bigint not null,                          -- 内部はセント単位の整数
  reason        text not null check (reason in ('grant','consume','refund')),
  work_id       uuid references works(id) on delete set null,
  run_id        uuid references runs(id)  on delete set null,
  created_at    timestamptz not null default now()
);
create index on token_ledger (account_id, created_at);

create or replace function account_balance_cents(a uuid) returns bigint
language sql stable as $$
  select coalesce(sum(delta_cents), 0) from token_ledger where account_id = a
$$;

create table audit_events (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  actor        text not null check (actor in ('user','executive','employee','system')),
  actor_id     uuid,
  verb         text not null,
  subject_type text not null,
  subject_id   uuid,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index on audit_events (account_id, created_at desc);
