-- 0031: 候補を「実際に需要があって、1人でできる仕事」で選べるようにする。
--
-- 社長の指示（2026-08-26）「**実際に需要があって個人1人でもできるような仕事、
-- ゴールの提案をして欲しい**」。読み直したら、いまの候補は
-- **その2つがどちらも入っていなかった**。
--
--   fit = speed（速さ）/ cost（安さ）/ strength（得意との相性）
--
-- つまり「速く始められて・安くて・得意に合う」で選んでいた。
-- **誰かが欲しがっているかは一度も問われていない**し、
-- **1人で回せるか**も入っていない（strength は工数ではない）。
-- だから抽象的で当たり障りのない案に寄っていた
-- （「小さな実用品の販売所」— 実際に出た案）。
--
-- **fit の3つを入れ替える**（`fit` は jsonb なので列は変えなくていい）:
--   demand（欲しがっている人がいるか）/ solo（1人で回せるか）/ speed（最初の1件までの近さ）
-- cost は落とす — **お金がかかることは「1人で回せない」に吸収される**。
--
-- そのうえで、候補が抽象に逃げられないように4つ書かせる。

-- **誰が買うのか。** 「個人」「中小企業」では書いたことにならない
alter table public.discovery_candidates
  add column if not exists who text not null default '';

-- **最初の1人をどこで見つけるか。** ここが書けない候補は、始められない
alter table public.discovery_candidates
  add column if not exists first_one text not null default '';

-- **確かめていないこと。**
-- 統括AIは Web に出られない（`OPENROUTER_WEB` は既定オフ）ので、
-- 需要は**記憶から言うしかない**。だから必ず「まだ確かめていない」と名乗らせる
-- （AI社員の憲法の「未確認と印を付ける」と同じ作法）。
alter table public.discovery_candidates
  add column if not exists unsure text not null default '';

-- **週に何時間要るか。** 社長の使える時間と突き合わせるための数字。
-- 0 は「書かれていない」（**無いものは無いと出す**ので、画面は 0 を出さない）
alter table public.discovery_candidates
  add column if not exists hours_per_week int not null default 0;
