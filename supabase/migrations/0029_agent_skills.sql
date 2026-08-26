-- 0029: 社員が自分でスキルを書き、使いながら直す（Hermes Agent の学習の輪）。
--
-- 元にしたのは NousResearch/hermes-agent（MIT）の閉じた学習の輪 —
-- 「難しい仕事のあと自分でスキルを作る」「使いながらスキルが自分で良くなる」。
-- **コードは持ち込めない**（Python 3.11 ＋ Node ＋ ripgrep ＋ ffmpeg ＋ Git ＋
-- ~/.hermes/ が前提で、Cloudflare Workers には載らない）ので、**輪だけ**を写す。
--
-- OneFound の決めごとと1つだけ衝突する — Hermes は社員が**自分で**自分を書き換えるが、
-- ここには「勝手に増えると社長が知らないうちに社員が変わる」という先の判断がある。
-- **社長が選んだ答えは「統括AIが通す」**（2026-08-26）。社員が書き、統括AIが見て通し、
-- 社長は結果を見るだけ。いつでも切れる。だから status が要る。

-- 4つめの出どころ。builtin=標準 / user=社長が上げた / learned=学びの1枚 / agent=社員が書いた
alter table agent_skills drop constraint agent_skills_source_check;
alter table agent_skills add constraint agent_skills_source_check
  check (source in ('builtin', 'user', 'learned', 'agent'));

-- **通る前は読まれない。** 既定は active — 社長が上げたものと標準スキルは、
-- これまでどおり最初から効く（列を足しただけで振る舞いを変えない）
alter table agent_skills add column if not exists status text not null default 'active';
alter table agent_skills add constraint agent_skills_status_check
  check (status in ('draft', 'active', 'rejected'));

-- 誰が書いたか。**employee_id（誰のスキルか）とは別**。
-- 社員が消えても、書かれたスキルは会社に残る（set null）
alter table agent_skills add column if not exists author_employee_id uuid
  references employees(id) on delete set null;

-- 統括AIの判定の記録。**落とした理由を残す** — 社長が読んで、戻せるように
alter table agent_skills add column if not exists review_note text;
alter table agent_skills add column if not exists reviewed_at timestamptz;

-- **直しは、通るまで効かない。** いま効いている body はそのままで、
-- 直したい中身を draft_body に置く（使えている手順書を、審査のあいだ止めない）
alter table agent_skills add column if not exists draft_body text;
alter table agent_skills add column if not exists draft_note text;
alter table agent_skills add column if not exists revision int not null default 0;

-- 審査待ちを引く（ポンプが毎回見るので覆いを付ける）
create index if not exists agent_skills_pending_idx
  on agent_skills (account_id, status) where status = 'draft';
create index if not exists agent_skills_author_idx
  on agent_skills (author_employee_id);
