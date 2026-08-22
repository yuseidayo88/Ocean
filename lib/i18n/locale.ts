import type { ja } from './ja'

/**
 * 言語まわりの**素の値**。ここには `next/headers` を持ち込まない。
 * サーバーからもブラウザからも読むので、片方でしか動かないものを混ぜない。
 */
export const LOCALES = ['ja', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ja'   // 日本語が既定
export const LOCALE_COOKIE = 'onefound_locale'

export type Dict = typeof ja

export function isLocale(v: string | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v)
}
