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

/**
 * **保存先が無いのに、あるふりをしない。**
 *
 * Supabase の設定が無いままデプロイすると、書き込みは**その関数の一時メモリ**に入る。
 * Vercel / Cloudflare では関数が入れ替わるたびに消え、関数ごとに中身が違うので、
 * 「会話がサイドバーに残らない」「開いたら見つからない」が**設定の問題として**起きる
 * （実際に起きた — 会話の id が `t-1` なら、この状態）。
 * デモ（DEMO_MODE）はわざとメモリなので言わない。設定漏れのときだけ1行出す。
 */
export function storeWarning(): string | null {
  const demo = process.env.DEMO_MODE === '1';
  const configured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (demo || configured) return null;
  return '保存先が設定されていません — 会話も Work も残りません';
}
