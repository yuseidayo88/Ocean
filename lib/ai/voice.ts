import { store } from '@/lib/store';
import { DEFAULT_VOICE_MODEL, voiceSpec } from './catalog';

/**
 * **台本を読み上げてもらう**（2026-08-27。社長の「他のやつから順に」の④）。
 *
 * 名簿には台本を書く人（執筆担当）はいるのに、**読み上げる手が無かった** —
 * 動画のナレーションも、聞ける説明も、社長が自分で吹き込むしかない。
 *
 * ## なぜ別のファイルか
 *
 * 絵（`lib/ai/image.ts`）とまったく同じ理由。`ModelProvider` は**文字と道具**の器で、
 * `Chunk` に音は無い。通すために広げると、通り道3つと決め打ちのプロバイダを
 * 全部直すことになる。**音は道具の中で1回呼ぶだけ**なので、ここに小さく閉じる。
 *
 * ## 決めごと
 *
 * - **既定はオフ。** 従量で課金されるので、押されるまで呼ばない（→ `voiceOn`）
 * - **原価は同じ台帳に、同じトークンで載る**（絵と同じ）。列も表も増えない
 * - **戻ってこなかったら、正直に失敗する。** 無音の成果物を作らない
 *
 * ## 確かめたこと / 確かめていないこと
 *
 * **口と綴りは OpenRouter の一覧と手引きを実際に引いて写した**（MCP から。2026-08-27）—
 * `POST /audio/speech` に `{ model, input, voice, response_format }` を送ると
 * **JSON ではなく音のバイト列**が返り、`X-Generation-Id` が付く。
 * 絵のときのように名前から組んでいない（**読めるものは読んでから書く**）。
 *
 * ただし**アプリからは `openrouter.ai` に出られない**ので、実際に鳴らしてはいない。
 * トークン数は返り値に入らないので、`X-Generation-Id` で**あとから引く**
 * （`/generation`）。引けなければ**0 で記帳しない** — 台本の長さから数える。
 */

const BASE = 'https://openrouter.ai/api/v1';

export type Voice = {
  base64: string;
  mime: string;
  /** 台帳に落とすためのトークン数 */
  usage: { inputTokens: number; outputTokens: number };
  /** 実際に走ったモデル（`runs.model` と同じ考え方） */
  model: string;
};

/**
 * **決め打ちの音**（鍵の無い環境。決め打ちの絵とまったく同じ考え方）。
 *
 * 0.1秒ぶんの無音の WAV。**本物と同じ道を通す**ためのもの —
 * 道具 → Storage → 成果物 → 画面 → 持ち出し、の穴はこれで見つかる。
 * 画面には**「これは仮の音声です」と必ず出す**（仮の計画・仮の絵と同じ作法）。
 */
const FAKE_WAV = (() => {
  const rate = 8000, secs = 0.1;
  const n = Math.round(rate * secs);
  const buf = new Uint8Array(44 + n * 2);
  const view = new DataView(buf.buffer);
  const put = (at: number, s: string) => { for (let i = 0; i < s.length; i++) buf[at + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); put(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  put(36, 'data'); view.setUint32(40, n * 2, true);
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
})();

/**
 * 会社が声を出してよいか。**鍵は見ない** —
 * 鍵が無い環境では決め打ちの音で同じ道を通す（見つかる穴は同じ）。
 */
export async function voiceOn(): Promise<boolean> {
  try {
    const prefs = await store().listPrefs();
    return prefs.some((p) => p.employeeId === null && p.voice);
  } catch {
    return false;
  }
}

/** 会社が選んでいる声のモデル。**知らない名前は既定に落とす** */
export async function voiceModel(): Promise<string> {
  try {
    const prefs = await store().listPrefs();
    const chosen = prefs.find((p) => p.employeeId === null)?.voiceModel;
    return voiceSpec(chosen)?.id ?? DEFAULT_VOICE_MODEL;
  } catch {
    return DEFAULT_VOICE_MODEL;
  }
}

/**
 * **台本の長さからトークンを見積もる**（`/generation` が引けなかったときだけ）。
 *
 * 日本語は1文字がだいたい1トークン、英数字は4文字で1トークン。
 * **0 で記帳するよりはずっと近い** — 0 にすると、タダの実行として台帳に載らず、
 * 残高も1日の上限も効かなくなる（0034 で踏んだのと同じ穴）。
 */
export function guessTokens(text: string): number {
  let jp = 0, other = 0;
  for (const c of text) { if (/[　-ヿ㐀-鿿＀-￯]/.test(c)) jp++; else other++; }
  return Math.ceil(jp + other / 4);
}

/** 実際に使ったぶんを、あとから引く。**引けなければ null**（作り話をしない） */
async function statsOf(id: string, key: string): Promise<{ inputTokens: number; outputTokens: number } | null> {
  try {
    const res = await fetch(`${BASE}/generation?id=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { data?: { tokens_prompt?: number; tokens_completion?: number } };
    const d = json.data;
    if (!d) return null;
    return { inputTokens: d.tokens_prompt ?? 0, outputTokens: d.tokens_completion ?? 0 };
  } catch {
    return null;
  }
}

/** 読み上げてもらう。**1本だけ。** */
export async function speak(
  script: string,
  opts: { model?: string; signal?: AbortSignal } = {},
): Promise<Voice> {
  const key = process.env.OPENROUTER_API_KEY;
  // **鍵が無ければ決め打ちの音。** 落とさずに、同じ道を最後まで通す
  if (!key) {
    return { base64: FAKE_WAV, mime: 'audio/wav', usage: { inputTokens: 0, outputTokens: 0 }, model: 'fake' };
  }
  const model = opts.model ?? (await voiceModel());
  const spec = voiceSpec(model);

  const res = await fetch(`${BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL ?? 'https://onefound.app',
      'X-Title': 'OneFound',
    },
    body: JSON.stringify({
      model, input: script,
      // **声は相手ごとに名前が違う。** 一覧に書いた既定を渡す（省くと断る相手がいる）
      ...(spec?.voice ? { voice: spec.voice } : {}),
      response_format: 'mp3',
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`声のモデルが ${res.status} を返しました`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  // **鳴らないものを成果物にしない**（空で返ってくることがある）
  if (bytes.length < 128) throw new Error('音声が返ってきませんでした');

  const gen = res.headers.get('x-generation-id');
  const real = gen ? await statsOf(gen, key) : null;
  return {
    base64: toBase64(bytes),
    mime: res.headers.get('content-type')?.split(';')[0] ?? 'audio/mpeg',
    model,
    // 引けたら実測、引けなければ台本の長さから（**0 では記帳しない**）
    usage: real ?? { inputTokens: guessTokens(script), outputTokens: 0 },
  };
}

/** バイト列を base64 に。**大きいものでも引数の数で落ちない**ように小分けにする */
function toBase64(b: Uint8Array): string {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < b.length; i += step) s += String.fromCharCode(...b.subarray(i, i + step));
  return btoa(s);
}
