-- 0024: 社員ごとの「どのモデルで、どれだけ考えるか」（agent_prefs）
--
-- メンバー画面のモデルと深さは、ここまで**押しても何も残らなかった**
-- （`ModelInline` / `EffortInline` は自分の中だけで値を持っていた）。
-- 選べる先が1つしか無かったあいだは、それでも嘘ではなかった。
-- Claude と OpenAI の6枚から選べるようになったので、保存先を作る。
--
-- **employee_id が null なら統括AI**（`agent_skills` と同じ書き方）。
-- 統括AIは employees に行を持たない（採用も解雇もできない）ので、
-- employee_id を主キーにした表には入れられない。
--
-- **`employee_settings` は落とす。** Phase 3 で「いつか使う」と置いた表で、
-- 1行も入っておらず、アプリからは1か所も読まれていなかった（0行を確認済み）。
-- しかも `model_fixed` は階層名（fast/standard/deep）に縛られていて、
-- **いま作っているもの（本物のモデル名）とは別の設計**。
-- 残しておくと「model_fixed があるのに、なぜ使っていないのか」を毎回考えることになる。
-- 一時停止（paused）とルール（rules）を作るときは、この表に列を足す。

create table agent_prefs (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null default private.current_account_id()
              references accounts(id) on delete cascade,
  employee_id uuid references employees(id) on delete cascade,  -- null = 統括AI
  -- 通り道での名前（`lib/ai/catalog.ts` の id）。
  -- **DBでは中身を縛らない** — 一覧はコードの表なので、増えるたびに移行が要らないように
  model       text,
  effort      text check (effort in ('none','low','medium','high','xhigh','max')),
  updated_at  timestamptz not null default now()
);

-- ポンプが読む表と同じ扱い（FK の覆い index。0016 と同じ理由）
create index on agent_prefs (account_id, employee_id);

-- **1人につき1行。** 同時に2つのタブから触っても2行にならない（0015 / 0017 と同じ姿勢）
create unique index agent_prefs_exec on agent_prefs (account_id) where employee_id is null;
create unique index agent_prefs_employee on agent_prefs (account_id, employee_id) where employee_id is not null;

-- RLS は 0003 と同じ一形（`account_id = private.current_account_id()`）。
-- **複数社に開くときも、この行は書き換えなくていい**
alter table agent_prefs enable row level security;
alter table agent_prefs force row level security;
create policy agent_prefs_tenant on agent_prefs for all
  using (account_id = private.current_account_id())
  with check (account_id = private.current_account_id());

grant select, insert, update, delete on agent_prefs to authenticated;

drop table if exists employee_settings;
