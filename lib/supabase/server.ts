import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * **ふだんは社長のセッション**（cookie）。行は必ず RLS（account_id）で絞られる。
 * service role はここでは使わない。
 *
 * ただしセッションが**無い**入口が1つある — Cron（`/api/cron`）。
 * そこだけは「runner」として**ふつうにログインした本物のセッション**を渡す
 * （→ `lib/run/runner.ts`）。役を増やさない・ポリシーを触らない・
 * service role を持ち出さない、の3つを同時に満たすのはこの形だけだった。
 * 受け渡しは AsyncLocalStorage — 引数で運ぶと、store の口 60本ぜんぶに
 * 「誰として」を足すことになる。
 */
const AS = new AsyncLocalStorage<string>()

/** その中だけ、渡したアクセストークンの持ち主として読み書きする */
export function runAs<T>(accessToken: string, fn: () => Promise<T>): Promise<T> {
  return AS.run(accessToken, fn)
}

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  /**
   * runner のとき。cookie は読まない（無い）。
   * **anon 鍵 ＋ そのユーザーの JWT** なので、RLS も既定値（`current_account_id()`）も
   * 社長のときとまったく同じに効く — 特別扱いがどこにも無い。
   */
  const token = AS.getStore()
  if (token) {
    return createServerClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      cookies: { getAll: () => [], setAll: () => {} },
    })
  }

  const store = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          // Server Component からは書けない。middleware が更新するので握りつぶす
        }
      },
    },
  })
}
