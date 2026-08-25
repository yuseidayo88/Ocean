import { LoginForm } from '@/components/auth/LoginForm'

/**
 * 入口。**器（Shell）の外**にある唯一の画面なので、レールも入力欄も無い。
 *
 * 戻ってきた理由（`?e=`）はサーバーで受けて渡す — こうすると `useSearchParams` が
 * 要らず、画面が1回で出る（読み込んでから理由が出てくる、が起きない）。
 */
export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;
  return <LoginForm why={e} />;
}
