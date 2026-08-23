import { memoryStore } from './memory';
import { supabaseStore } from './supabase';
import type { Store } from './types';

export * from './types';

/**
 * どこに書くかを1か所で決める。
 *
 * `DEMO_MODE` のとき、または Supabase の設定が無いときはメモリ。
 * **`.env*` には DEMO_MODE を書かない** — OpenNext が既定値として焼き込み、本番にも付いていく。
 */
export function store(): Store {
  const demo = process.env.DEMO_MODE === '1';
  const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return demo || !configured ? memoryStore : supabaseStore;
}
