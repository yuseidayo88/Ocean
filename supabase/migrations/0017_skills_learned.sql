-- 0017: スキルの3つめの出どころ「学び」（learned）。
--
-- スキル＝必要なときだけ読む手順書（builtin / user）に、
-- **社員が仕事から書き溜めるメモ**を足す。ルールには自動で書かせない —
-- ルールは毎回効く制約なので、勝手に増えると社長が知らないうちに社員が変わる。
-- 学びは1人1枚（learnings.md）に追記し、画面で見えて、社長が消せる。

alter table agent_skills drop constraint agent_skills_source_check;
alter table agent_skills add constraint agent_skills_source_check
  check (source in ('builtin', 'user', 'learned'));

-- 同じファイルを二度作らない（標準スキルの播種と学びの1枚を、
-- 同時に開いた2つのタブから守る。0015 と同じ姿勢 — 一意性はDBで）
create unique index if not exists agent_skills_company_file
  on agent_skills (account_id, filename) where employee_id is null;
create unique index if not exists agent_skills_employee_file
  on agent_skills (account_id, employee_id, filename) where employee_id is not null;
