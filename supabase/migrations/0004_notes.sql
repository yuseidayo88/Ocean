-- 意味を取り違えないための注釈。表は足さない。
--
-- 複数社（1つのログインで会社を切り替える）は Phase 11。
-- いま 1対1 を仮定しているのは users.account_id の1列だけで、
-- 業務データはユーザーではなく accounts にぶら下がっている。
-- memberships を先に置くと、1人1行しか入らない表が誰にも通られないまま残るので置かない。

comment on column users.account_id is
  'いま見ている会社。Phase 11 で memberships を足し active_account_id に降格する。
   アプリからは直接読まず private.current_account_id() を通すこと';

comment on table accounts is
  '会社。課金・トークン残高・全業務データの所有者。ユーザーではなくここにぶら下げる';

comment on function private.current_account_id() is
  'RLS の唯一の入口。複数社に開くときはこの中身だけを書き換え、ポリシー28本は触らない';
