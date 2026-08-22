import { cookies } from 'next/headers'
import { ja } from './ja'
import { en } from './en'
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Dict, type Locale } from './locale'

export * from './locale'

const DICTS: Record<Locale, Dict> = { ja, en: en as Dict }

/**
 * サーバー側で辞書を引く。Cookie が無ければ日本語。
 * **一番外側のレイアウトからは呼ばない** — 呼ぶと全画面が毎回作り直しになる。
 * 言語で中身が変わる場所で、その場所だけ呼ぶ。
 */
export async function getDict(): Promise<{ locale: Locale; t: Dict }> {
  const c = await cookies()
  const raw = c.get(LOCALE_COOKIE)?.value
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE
  return { locale, t: DICTS[locale] }
}
