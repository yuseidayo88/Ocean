-- 決定は消せない。
--
-- 「決定事項は追記のみ」の守りは `decisions_append_only`（UPDATE の引き金）だけで、
-- **DELETE が素通りだった**（Phase 9 の探針で発見 — 実際に消せた）。
-- 決め直しは新レコード＋ supersedes_id、が設計（→ 01-data-model）。消す道は要らない。
--
-- rule ではなく revoke（hire_candidates と同じ理由 — rule だと cascade が壊れて退会できなくなる。
-- works の削除からの cascade は表の所有者として走るので、revoke の影響を受けない）。

revoke delete on decisions from authenticated;
