# 動かし方

## いま動くところまで（Phase 3）

```bash
npm install
npm run dev              # http://localhost:3000
```

`.env.example` を `.env.local` にコピーして、Supabase の URL と anon キーを入れます。
未設定のうちは、ログインを素通しして空のホームが見えます。

## Cloudflare Workers の上で動かす

```bash
npm run cf:build                          # OpenNext で .open-next/worker.js を作る
npx wrangler dev --local                  # 本番と同じ設定で workerd の上に載せる
npx wrangler dev --local --env preview    # レビュー用（ダミーで全画面）
```

`wrangler dev` は `.env.local` を読みません。**`.dev.vars` に同じものを置きます。**

`/api/health` で土台の状態が見られます。

### Worker は2本

| | 名前 | vars | 中身 |
|---|---|---|---|
| 本番 | `onefound` | `APP_ENV=production` | ログインが要る |
| レビュー | `onefound-preview` | `APP_ENV=preview` `DEMO_MODE=1` | ダミーで全画面 |

```bash
npm run cf:deploy           # 本番
npm run cf:deploy:preview   # レビュー用
```

**デプロイには Cloudflare の API トークンが要ります**（`CLOUDFLARE_API_TOKEN`。
テンプレートは "Edit Cloudflare Workers"）。いまの開発環境からは `api.cloudflare.com` に
出られないので（プロキシが 403 を返す）、**デプロイは手もとか CI から**打ちます。
ビルドと workerd 上での動作確認はここでできています。

## ダミーデータで全画面を見る（Phase 4）

いま見られるプレビュー: https://onefound-yuseidayo88-3854s-projects.vercel.app

**中身はダミーで、押しても書き込みはどこにも届きません。**
ブランチに push すると作り直されます（Vercel プロジェクト `onefound`・環境変数なし）。
**本番の行き先は Cloudflare Workers**（→ `docs/design/05-tech-and-cost.md` の判断ログ）。
Cloudflare のトークンが入るまでは、ここが静止画の代わりです。

ログインを通さずに全画面を触るには `DEMO_MODE=1` を立てます。

```bash
npm run dev:demo      # next dev（ダミーで全画面）
npm run start:demo    # next start（ビルド後）
npx wrangler dev --local --env preview   # workerd（本番と同じ形）
```

**`.env.local` には書かないこと。** OpenNext が `.env*` を**既定値としてビルド成果物に焼き込む**ので、
そのまま本番にも付いていきます（実際に一度そうなりました）。
置き場所は npm スクリプトの頭か、`wrangler.jsonc` の `env.preview.vars` だけ。
紛れ込んだときのために、`APP_ENV=production` では効かないようにもしてあります。

```
/home            ホーム（?view=desk / progress / flow で切替）
/work/w-japanese  Work / その /plan で計画の承認
/tasks /deliverables /decisions /team /inbox /hire /skills
/chat/t-price     チャット / /chat/new で新規
/start /discovery /discovery/result /import /diagnosis   入口
```

```json
{
  "ok": true,
  "runtime": "Cloudflare-Workers",
  "supabase": true,
  "models": { "anthropic": false, "openai": false },
  "tiers": { "fast": "claude-haiku-4-5-20251001", "standard": "claude-sonnet-5", "deep": "claude-opus-5" }
}
```

## データベース

`supabase/migrations/` を順に流します。

```bash
supabase db push                       # Supabase CLI
# または psql で直接
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_entry_chat_ledger.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_rls.sql
psql "$DATABASE_URL" -f supabase/migrations/0004_notes.sql
psql "$DATABASE_URL" -f supabase/migrations/0005_drop_errands.sql
psql "$DATABASE_URL" -f supabase/migrations/0006_plan_draft.sql
psql "$DATABASE_URL" -f supabase/migrations/0007_account_default.sql
psql "$DATABASE_URL" -f supabase/migrations/0008_works_audit.sql
psql "$DATABASE_URL" -f supabase/migrations/0009_seq.sql
psql "$DATABASE_URL" -f supabase/migrations/0010_task_owner_hint.sql
psql "$DATABASE_URL" -f supabase/migrations/0011_phase_review.sql
psql "$DATABASE_URL" -f supabase/migrations/0012_run_path.sql
psql "$DATABASE_URL" -f supabase/migrations/0013_decisions_no_delete.sql
```

`0003` は RLS と、不変条件をデータベース側で守るためのトリガを入れます。

RLS の裏方（`current_account_id` など）は **`private` スキーマ**に置いています。
PostgREST に公開されないので、`/rest/v1/rpc/` から呼ばれません。
`public` に置くと、SECURITY DEFINER の関数が外から叩ける状態になります。

流したあとは Supabase のリンターを見てください。**警告0件が正常です。**

`0004` は注釈だけです（表は足しません）。**複数社は Phase 11**。
1対1を仮定しているのは `users.account_id` の1列だけで、業務データは
ユーザーではなく `accounts` にぶら下がっています。
→ `docs/design/05-tech-and-cost.md` 判断ログ

`0005` は**用事（errand）を廃止**します。`tasks.kind` と `works.origin_kind` を落とし、
`tasks.work_id` を NOT NULL にします。小さい頼みごとは、いまある Work の中のタスクになります。
→ `docs/design/06-work-and-scope.md` 判断ログ

`0006` は `works.plan_draft`（統括AIが立てた計画案そのもの）を足します。**Phase 5**。

`0007` は **`account_id` の既定値**を22表に置きます（`accounts` と `users` は除く）。
アプリのどの insert も `account_id` を書きません — 表が23あるので、書く方式にすると
1か所の書き忘れが**本番でだけ** NOT NULL 違反になります
（実際 Phase 5 の insert は全部持っていませんでした）。
RLS の with check は `account_id = private.current_account_id()` のままなので、
既定値と方針が一致します。**ポリシーは1行も書き換えていません**（→ Phase 11 も無変更）。

`0008` は **承認と引き直しを台帳に残す引き金**です。`audit_events` は裏方の表で、
`authenticated` に insert を渡していません（渡すと `executive` / `system` の行まで
偽造できる）。`public` に SECURITY DEFINER の関数を置けば `rpc` から書けますが、
リンターの警告が1件増えるので採りませんでした。**引き金なら、アプリが呼び忘れることも
嘘の数を書くこともできません。**

`0009` は **`questions` と `tasks` に `seq`** を足します。どちらも1本の insert 文で
まとめて入るので `created_at` が**全行同着**になり、`order by created_at` では
並びが決まりませんでした（実測: 同じ文で入れた質問3件の created_at の種類数 = 1）。
`answer(work, index)` が**別の質問に答えを書き込みうる**状態でした。

`0010` は **`tasks.owner_hint`**。統括AIはタスクごとに担当を提案しますが、
どこにも保存していませんでした。計画画面は最初のタスクの提案を「フェーズの担当」として出し、
承認は全タスクを先頭の社員に割り当てる — 画面とデータベースが別々の推測をしていました。

`0011` は **フェーズに `review`** を足します。設計には
`pending → active → review → done` と書いてあるのに、制約は
`planned / active / done / skipped` の4つで、`review`（全タスクが終わって社長待ち）が
表せませんでした。**Phase 9 の差し戻しが乗る場所**です。

### データベース側で守っていること

| 不変条件 | 守り方 |
|---|---|
| すべてのタスクは Work に属する | `tasks.work_id` NOT NULL（用事は 0005 で廃止） |
| 担当が社員なら社員IDが要る | check 制約 `task_assignee_shape` |
| 決定事項は追記のみ | トリガ `decisions_append_only` |
| 進捗は導出値。直接書けない | トリガ `tasks_progress_is_derived`<br>（列単位の revoke は表単位の権限があると効かない） |
| 残高は台帳の合計 | 関数 `account_balance_cents` |
| 候補は消さない | `revoke delete`（rule だと cascade が壊れて退会できなくなる） |
| **決定も消さない** | `revoke delete`（0013）。追記のみの引き金は UPDATE しか見ておらず、DELETE が素通りだった |
| 退会したらデータも消える | トリガ `users_drop_empty_account` |
| 会社をまたいで見えない | 全27表の RLS（実測） |
| `account_id` を書き忘れられない | 22表の既定値 `private.current_account_id()`（0007） |
| 質問はスレッドに属する | `questions.thread_id` NOT NULL（Work のスレッドを先に作る） |
| 承認と引き直しは必ず台帳に残る | トリガ `works_audit`（0008）。アプリは `audit_events` に書けない |
| 質問とタスクの並びが決まる | `seq`（0009）。`created_at` は同じ insert 文で同着になる |

## 環境変数

| 変数 | いつ要るか |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ログインとデータ。Phase 3 |
| ~~`SUPABASE_SERVICE_ROLE_KEY`~~ | **使っていない**（.env.example からも消した）。行は全部 RLS で絞るので、漏れたとき全社が出る鍵を持つ理由がない。Phase 7 の実行基盤（Durable Object にはセッションが無い）でどう書くかは、**そのとき service role を安易に持ち出さずに決める** — 候補は「絞った専用ロール ＋ 引き金」 |
| `OPENROUTER_API_KEY` | AI社員が動き出すとき。Phase 7。**通り道は OpenRouter**（→ 05 判断ログ） |
| `APP_URL` | OpenRouter の一覧に出す名前（任意） |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | 直につなぐときの逃げ道。`lib/ai/tiers.ts` の `vendor` を書き換えたときだけ |

本番（Cloudflare）では `wrangler secret put OPENROUTER_API_KEY` で入れる。
`wrangler.jsonc` の `vars` に書かない（`vars` は平文でリポジトリに残る）。

**鍵が入ったら最初に確かめること**（この開発環境からは `openrouter.ai` に出られない）:
`GET https://openrouter.ai/api/v1/models` でモデルの slug
（`anthropic/claude-opus-5` の綴り）／ プロンプトキャッシュの透過 ／ `usage` の中身。

### 試すあいだは、ただで動く

**鍵を入れるだけでいい。** `OPENROUTER_API_KEY` があれば、
**本番以外では自動で無料のモデル**（`stealth/ox-alpha` — Ox Alpha）を使う。
残高が 0 でも動く。切り替えは `modelFor()`（`lib/ai/tiers.ts`）の3段:

| 順 | 何を見るか | いつ使われるか |
|---|---|---|
| ① | `OPENROUTER_MODEL_DEEP` / `_STANDARD` / `_FAST` | 明示したとき。**常に最優先** |
| ② | `TEST_MODEL`（`stealth/ox-alpha`） | `APP_ENV` が `production` でないとき |
| ③ | `TIER_TABLE` のモデル（Claude・有料） | 本番（`wrangler.jsonc` が `APP_ENV=production` を入れる） |

Ox Alpha を選んだ理由（実測 2026-08-24）— **$0/M** ／ **tools 対応**
（統括AIは1往復で道具を5つ呼ぶので**これが絶対条件**。無料モデルの多くは非対応で落ちる）
／ 100万トークン ／ 稼働 99.99%。**`stealth/` は前触れなく消える枠**なので本番では使わない。

**遅い。** p50 5秒・p90 35秒・p99 96秒（Stealth プロバイダの実測）。
`app/(app)/layout.tsx` の `maxDuration = 300` はこのため。
無料モデルは賢さが足りず「統括AIが入れ物を決めませんでした」で止まることもある。
それは**モデルの限界で、コードの穴ではない**（配線の確認までが無料枠の仕事）。

無料モデルは https://openrouter.ai/settings/privacy で
「Enable free endpoints that may train on inputs」を有効にしないと 404 になる。
**入力が学習に使われうる**ので、テストの文面だけにすること。
ほかの候補を探すなら **無料 × 道具対応** で絞る:
https://openrouter.ai/models?max_price=0&supported_parameters=tools

## デプロイ

```bash
npm run cf:deploy        # Cloudflare のトークンが要る
```
