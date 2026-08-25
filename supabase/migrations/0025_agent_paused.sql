-- 0025: 一時停止は「設定」であって「いま何をしているか」ではない。
--
-- メンバー画面の「一時停止」を本物にするとき、いちど `employees.status` に
-- 'paused' を書こうとした（0001 の check には最初から入っている）。**それは間違い。**
-- あの列は実行の生き死にを持っていて、`startRun` が running、`finishRun` が idle に
-- 書き換える。**止めた印が、次の実行が終わった瞬間に消える。**
--
-- 止めるかどうかは社長が決める設定なので、モデルと深さと同じ場所（0024）に置く。

alter table agent_prefs add column if not exists paused boolean not null default false;
