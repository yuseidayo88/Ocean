import { AppError } from '@/lib/errors';
import type { Option, Question } from './types';

/**
 * 統括AIが道具に書いた値を、画面が読める形に正す。
 *
 * **型を被せるだけにしない。** `as Question[]` は嘘をつける — 実モデルが
 * `options` を落とすと、そのまま画面まで届いて `q.options.map` で落ちる
 * （入力スキーマに書いてあることと、返ってくるものは別）。
 */

export function toOptions(raw: unknown): Option[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        label: String(o.label ?? ''),
        description: String(o.description ?? ''),
        recommended: !!o.recommended,
      };
    })
    .filter((o) => o.label);
}

export function toQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const q = (x ?? {}) as Record<string, unknown>;
      return { body: String(q.body ?? ''), why: String(q.why ?? ''), options: toOptions(q.options) };
    })
    .filter((q) => q.body);
}

/**
 * 有限の数だけ通す。**NaN を止める** — `Number('週10')` は NaN で、
 * NaN は nullish ではないので `??` のマージを素通りし、以後どの往復でも消えない
 * （「週NaN時間」というチップが出て、ゴール文にもそのまま焼き込まれる）。
 */
export function finite(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 0〜100 に収める（fit の3スコア） */
export function score(v: unknown): number {
  return Math.max(0, Math.min(100, finite(v) ?? 0));
}

/**
 * **止まった理由を見る。** 見ないと、枠に当たって切れた1往復が
 * 「道具が1つも呼ばれなかった」＝無言の空振りになる（押しても何も起きない）。
 * `content_filter` は OpenRouter 側の語彙（`refusal` は来ない）。
 */
export function checkStop(stop: string | null, got: Iterable<string>, long: string): void {
  const tools = [...got].join(',') || 'なし';
  if (stop === 'max_tokens' || stop === 'length') {
    throw new AppError('upstream', `stopped at max_tokens (tools: ${tools})`, undefined, long);
  }
  if (stop === 'refusal' || stop === 'content_filter') {
    throw new AppError('upstream', `model refused (${stop})`, undefined,
      '統括AIがこの依頼には応えられませんでした');
  }
}
