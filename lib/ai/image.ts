import { store } from '@/lib/store';
import { DEFAULT_IMAGE_MODEL, imageSpec } from './catalog';

/**
 * **絵を1枚もらう**（2026-08-27。社長の「ロゴ作る時は GPT の AI 使うようにしようかな
 * あと Nano Banana とか」）。
 *
 * ## なぜ別のファイルか
 *
 * `ModelProvider`（`provider.ts`）は**文字と道具**のための器で、`Chunk` に絵は無い。
 * 絵を通すために `Chunk` を広げると、通り道3つ（openrouter / openai / anthropic）と
 * 決め打ちのプロバイダを全部直すことになる。**絵は道具の中で1回呼ぶだけ**なので、
 * ここに小さく閉じる（MCP を `fetch` だけで書いたのと同じ判断）。
 *
 * ## 決めごと
 *
 * - **既定はオフ。** 従量で課金されるので、押されるまで呼ばない（→ `imagesOn`）
 * - **原価は同じ台帳に、同じトークンで載る**（社長の「画像生成した時のトークンも
 *   計算してほしい」）。画像のモデルは出力トークンで数える（1枚 ≈ 1000〜1500）ので、
 *   `runs` → `token_ledger` の道がそのまま使える。**列も表も増えない**
 * - **戻ってこなかったら、正直に失敗する。** 空の画像の成果物を作らない
 *
 * ## 確かめていないこと
 *
 * この環境から `openrouter.ai` に出られないので、**綴りも返りの形も実測していない**。
 * OpenRouter は画像を返すとき `message.images[].image_url.url`（data URI）に入れる、
 * という形を前提に書いてある。鍵が入ったら最初にここを確かめる（→ `docs/RUNNING.md`）。
 */

const BASE = 'https://openrouter.ai/api/v1';

export type Picture = {
  base64: string;
  mime: string;
  /** 台帳に落とすためのトークン数（画像は出力トークンで数える） */
  usage: { inputTokens: number; outputTokens: number };
  /** 実際に走ったモデル（`runs.model` と同じ考え方で、あとから何で描いたか分かる） */
  model: string;
};

/**
 * **決め打ちの絵**（鍵の無い環境。文字の `FakeProvider` と同じ考え方）。
 *
 * 256×256 の PNG を1枚だけ持つ。**本物と同じ道を通す**ためのもの —
 * 道具 → Storage → 成果物 → 画面 → 持ち出し → 差し戻し、の穴はこれで見つかる。
 * 画面には**「これは仮の画像です」と必ず出す**（仮の計画・仮の返事と同じ作法）。
 */
const FAKE_PNG =
  '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';

/**
 * 会社が絵を描いてよいか。**鍵は見ない** —
 * 鍵が無い環境では決め打ちの絵で同じ道を通す（見つかる穴は同じ）。
 */
export async function imagesOn(): Promise<boolean> {
  try {
    const prefs = await store().listPrefs();
    return prefs.some((p) => p.employeeId === null && p.images);
  } catch {
    return false;
  }
}

/** 会社が選んでいる絵のモデル。**知らない名前は既定に落とす**（画面と実物を食い違わせない） */
export async function imageModel(): Promise<string> {
  try {
    const prefs = await store().listPrefs();
    const chosen = prefs.find((p) => p.employeeId === null)?.imageModel;
    return imageSpec(chosen)?.id ?? DEFAULT_IMAGE_MODEL;
  } catch {
    return DEFAULT_IMAGE_MODEL;
  }
}

/**
 * 描いてもらう。**1枚だけ。**
 * `from` を渡すと「この絵を直す」になる（差し戻しのときに前の版を渡す）。
 */
export async function draw(
  prompt: string,
  opts: { model?: string; from?: { base64: string; mime: string }; signal?: AbortSignal } = {},
): Promise<Picture> {
  const key = process.env.OPENROUTER_API_KEY;
  // **鍵が無ければ決め打ちの絵。** 落とさずに、同じ道を最後まで通す
  if (!key) return { base64: FAKE_PNG, mime: 'image/png', usage: { inputTokens: 0, outputTokens: 0 }, model: 'fake' };
  const model = opts.model ?? (await imageModel());

  const content: unknown[] = [{ type: 'text', text: prompt }];
  // 直すときは、前の絵をそのまま渡す（Nano Banana はここが得意）
  if (opts.from) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${opts.from.mime};base64,${opts.from.base64}` },
    });
  }

  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL ?? 'https://onefound.app',
      'X-Title': 'OneFound',
    },
    body: JSON.stringify({
      model,
      modalities: ['image', 'text'],
      messages: [{ role: 'user', content }],
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`画像のモデルが ${res.status} を返しました`);

  const json = await res.json() as {
    choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? '';
  const m = /^data:([^;]+);base64,(.+)$/s.exec(url);
  // **絵が来なかったら、来なかったと言う。** 空の成果物を作らない
  if (!m) throw new Error('画像が返ってきませんでした');

  return {
    mime: m[1], base64: m[2], model,
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    },
  };
}
