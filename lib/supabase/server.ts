import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * サーバー側の Supabase クライアント。
 * 行は必ず RLS（account_id）で絞られる。service role はここでは使わない。
 */
export async function createClient() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  )
}
