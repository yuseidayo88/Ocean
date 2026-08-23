import { cookies } from 'next/headers'
import { ja } from './ja'
import { en } from './en'
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Dict, type Locale } from './locale'

export * from './locale'

const DICTS: Record<Locale, Dict> = { ja, en: en as Dict }

/**
 * いまの言語だけを読む。**辞書は持ってこない。**
 * `<html lang>` に入れるだけの用途で辞書まで引くと、一番外側のレイアウトが
 * 辞書に依存することになる（＝言語を足すたびに全画面が作り直しになる）。
 */
export async function getLocale(): Promise<Locale> {
  const raw = (await cookies()).get(LOCALE_COOKIE)?.value
  return isLocale(raw) ? raw : DEFAULT_LOCALE
}

/**
 * サーバー側で辞書を引く。Cookie が無ければ日本語。
 * **一番外側のレイアウトからは呼ばない** — 呼ぶと全画面が毎回作り直しになる。
 * 言語で中身が変わる場所で、その場所だけ呼ぶ。
 *
 * **いまは誰も呼んでいない。** 画面の文言は日本語で直接書いてある（→ `lib/i18n/ja.ts` の頭）。
 * 英語に開くのは Phase 11。骨だけ先に置いてある。
 */
export async function getDict(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await getLocale()
  return { locale, t: DICTS[locale] }
}
