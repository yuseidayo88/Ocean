-- フェーズに `review` を足す。
--
-- 設計（`docs/design/04-state-machines.md`）は
--   pending → active → review → done / skipped
-- と書いてあるのに、制約は `planned / active / done / skipped` だった。
--   ・`pending` は名前違い（アプリは `planned` を書いている → 設計側を直す）
--   ・**`review` はどこにも無かった**
--
-- `review` は「このフェーズのタスクが全部終わって、社長が見るのを待っている」状態。
-- **Phase 9（判断と受け渡し）の差し戻しがここに乗る。**
-- 状態の語（→ CLAUDE.md）でいうと **要確認**。無いまま Phase 9 に入ると、
-- 「終わったが承認前」を表せず、`active` のまま扱うことになる。

alter table phases drop constraint phases_status_check;
alter table phases add constraint phases_status_check
  check (status = any (array['planned', 'active', 'review', 'done', 'skipped']));

comment on column phases.status is
  'planned=まだ / active=実行中 / review=要確認（全タスク done、社長待ち） / done=完了 / skipped=不要と判断';
