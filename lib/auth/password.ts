/**
 * パスワードの決まり。**画面と Supabase で同じものを使う**ため、ここ1か所に書く。
 *
 * **これはUXであって、セキュリティそのものではない。**
 * 匿名鍵はブラウザに配られているので、この画面を通さずに Supabase の認証API を
 * 直接叩けば、弱いパスワードでも作れてしまう。**本当に止めるのは Supabase 側の設定**
 * （Authentication → Providers → Email の Minimum password length と
 * Required characters）。**下の記号の並びは、そこで選べる「いちばん強い」組と同じもの**に
 * してある（→ `docs/RUNNING.md`）。ここが厳しくて向こうが緩いと、
 * 画面で断られたものが API では通る — 揃えておく理由はそれ。
 */

/** Supabase が記号として数える文字。**この並びから足しても引いてもいけない** */
export const SYMBOLS = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~';

/** いちばん短いパスワード。Supabase の既定（6）より長くする */
export const MIN_LEN = 10;

/** 1つの決まり。**満たしたかどうかを社長がその場で見る**ので、短い名前で書く */
export type Rule = { key: string; label: string; ok: (pw: string) => boolean };

export const RULES: Rule[] = [
  { key: 'len', label: `${MIN_LEN}文字以上`, ok: (p) => p.length >= MIN_LEN },
  { key: 'upper', label: '大文字', ok: (p) => /[A-Z]/.test(p) },
  { key: 'lower', label: '小文字', ok: (p) => /[a-z]/.test(p) },
  { key: 'digit', label: '数字', ok: (p) => /[0-9]/.test(p) },
  { key: 'symbol', label: '記号', ok: (p) => [...p].some((c) => SYMBOLS.includes(c)) },
];

/** 全部満たしているか。**送るボタンはこれが true のときだけ押せる** */
export const passwordOk = (pw: string) => RULES.every((r) => r.ok(pw));
