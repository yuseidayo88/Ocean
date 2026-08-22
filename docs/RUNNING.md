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

### データベース側で守っていること

| 不変条件 | 守り方 |
|---|---|
| すべてのタスクは Work に属する | `tasks.work_id` NOT NULL（用事は 0005 で廃止） |
| 担当が社員なら社員IDが要る | check 制約 `task_assignee_shape` |
| 決定事項は追記のみ | トリガ `decisions_append_only` |
| 進捗は導出値。直接書けない | トリガ `tasks_progress_is_derived`<br>（列単位の revoke は表単位の権限があると効かない） |
| 残高は台帳の合計 | 関数 `account_balance_cents` |
| 候補は消さない | `revoke delete`（rule だと cascade が壊れて退会できなくなる） |
| 退会したらデータも消える | トリガ `users_drop_empty_account` |
| 会社をまたいで見えない | 全28表の RLS |

## 環境変数

| 変数 | いつ要るか |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ログインとデータ。Phase 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | バックエンドから進捗や台帳を書くとき。Phase 6 以降 |
| `ANTHROPIC_API_KEY` | AI社員が動き出すとき。Phase 7 |
| `OPENAI_API_KEY` | 同上（いまは全階層 Anthropic なので任意） |

## デプロイ

```bash
npm run cf:deploy        # Cloudflare のトークンが要る
```
