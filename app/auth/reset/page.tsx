import { ResetForm } from '@/components/auth/ResetForm'

/**
 * 再設定のリンクから着くところ。**器の外**（レールも入力欄も無い）。
 *
 * ここに来た時点で、`/auth/callback` が引き換えたセッションが載っている。
 * 載っていなければ**新しいパスワードは決められない** — それは画面が正直に言う。
 */
export default function ResetPage() {
  return <ResetForm />
}
