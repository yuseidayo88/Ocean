import { cookies } from 'next/headers'
import { ja } from './ja'
import { en } from './en'

export const LOCALES = ['ja', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ja'   // 日本語が既定
export const LOCALE_COOKIE = 'onefound_locale'

export type Dict = typeof ja

const DICTS: Record<Locale, Dict> = { ja, en: en as Dict }

export function isLocale(v: string | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v)
}

/** サーバー側で辞書を引く。Cookie が無ければ日本語 */
export async function getDict(): Promise<{ locale: Locale; t: Dict }> {
  const c = await cookies()
  const raw = c.get(LOCALE_COOKIE)?.value
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE
  return { locale, t: DICTS[locale] }
}
