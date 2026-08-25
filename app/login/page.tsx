import { LoginForm, type Mode } from '@/components/auth/LoginForm'

/**
 * 入口。**器（Shell）の外**にある唯一の画面なので、レールも入力欄も無い。
 *
 * 戻ってきた理由（`?e=`）と、どの姿で開くか（`?mode=`）はサーバーで受けて渡す —
 * こうすると `useSearchParams` が要らず、画面が1回で出る
 * （読み込んでから理由が出てくる、が起きない）。
 */
const MODES: Mode[] = ['login', 'signup', 'forgot']

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ e?: string; mode?: string }>;
}) {
  const { e, mode } = await searchParams
  return <LoginForm why={e} mode={MODES.find((m) => m === mode) ?? 'login'} />
}
