import next from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

/**
 * lint の設定。**Next 16 で `next lint` は無くなった**ので eslint を直接呼ぶ。
 * `npm run lint` が壊れていたあいだ、6,000行が一度も検査されていなかった
 * （死んだコードが溜まった原因のひとつ）。
 *
 * 見るのは3つだけ。**通らない規則を並べるより、通る規則を守るほうがいい。**
 *   ① 使われていないもの
 *   ② hooks の依存（DOM を直に触る画面が多いので効く）
 *   ③ 押せるものに名前があるか（a11y。eslint-config-next に入っている）
 */
export default tseslint.config(
  {
    ignores: [
      '.next/**', '.open-next/**', '.wrangler/**', 'node_modules/**',
      // デザインの書き出し（生成物。手で直さない）
      'design/**',
      'next-env.d.ts', 'cloudflare-env.d.ts',
    ],
  },
  ...next,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 使っていないものは消す。`_` で始まるものだけ残していい（型を合わせるため）
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none',
      }],
      // any は書かない。DB の行を通すところがあるので警告どまり
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // 機械で確かめる道具は Node のスクリプト
    files: ['tools/**/*.mjs'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
);
