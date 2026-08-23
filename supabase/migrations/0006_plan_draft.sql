-- 統括AIが立てた計画案そのものを1列に残す（Phase 6）。
--
-- なぜ表を足さないか:
--   これは「AIが何を出したか」の記録であって、業務データではない。
--   フェーズ・タスク・質問は構造化した表に既に落としてあり、そちらが真実。
--   ここは**承認画面の読み戻し元**と、あとで「なぜこの計画だったか」を辿るための控え。
--
-- 中身は lib/exec/types.ts の Draft と同じ形:
--   { container, questions, hires, plan, real }
-- `real` は本物のモデルが書いたのか、鍵が無くて決め打ちだったのか。

alter table works add column plan_draft jsonb;

comment on column works.plan_draft is
  '統括AIが立てた計画案そのもの（lib/exec/types.ts の Draft）。
   承認画面がここから読み戻す。業務データはフェーズ・タスク・質問の表のほうが真実';
