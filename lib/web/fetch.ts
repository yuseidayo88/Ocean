/**
 * **URL を1本読む**（2026-08-27。社長の「他のやつから順に」の①）。
 *
 * ここまで、AI社員に渡せる材料は**社長が ＋ で落としたファイルだけ**だった。
 * 取り込みの URL は `queued`（待機）のまま置かれ、**中身は一度も読まれていない**。
 * 検索はあるのに「**このページを読んで**」ができない、という穴。
 *
 * ## 危ないのは「モデルが行き先を決める」こと
 *
 * 取りに行く先を決めるのはモデル（`read_url`）か社長（貼った URL）で、
 * **どちらもこちらの手の内ではない**。放っておくと、サーバーの中からしか見えない
 * ところ（クラウドのメタデータ・社内のアドレス・localhost）を読ませることができる。
 * だから**行き先そのものを先に断る** — 取ってから中身を見て判断しない。
 *
 * ## 断るもの
 *
 * - https 以外（`DEMO_MODE` のときだけ localhost の http を通す。検査のため）
 * - 私設・ループバック・リンクローカルのアドレス（名前でも数字でも）
 * - 既定でない口（ポート）
 * - URL に埋め込まれた利用者名とパスワード
 * - **転送の先も毎回同じ検査に掛ける**（`redirect: 'manual'` で自分で辿る）
 *
 * ## 上限
 *
 * 15秒 / 2MB / 転送3回。**読めなかったら読めなかったと言う**（作り話をしない）。
 */

/** 読めた1ページ。`text` は本文だけ（記号と飾りは落としてある） */
export type Page = { url: string; title?: string; text: string };

const MAX_BYTES = 2_000_000;
const MAX_HOPS = 3;
const TIMEOUT_MS = 15_000;

/** そのまま読める型だけ。PDF や画像は**読めないと言う**（読めたふりをしない） */
const READABLE = /^(text\/html|text\/plain|text\/markdown|application\/(json|xhtml\+xml))/i;

/** 名前で分かる、外から見えないところ */
const LOCAL_NAME = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i;

/** 数字で分かる、外から見えないところ（IPv4） */
function privateV4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, Number(m[2]), Number(m[3]), Number(m[4])].some((x) => x > 255)) return true; // 壊れた形も断る
  return a === 0 || a === 10 || a === 127
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)          // クラウドのメタデータはここ
    || a >= 224;                          // マルチキャストと予約
}

/** IPv6 のループバック・ユニークローカル・リンクローカル */
function privateV6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!h.includes(':')) return false;
  return h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe8|^fe9|^fea|^feb/.test(h);
}

/**
 * **入り口をそろえる。** モデルも社長も、`example.com/about` のように
 * 頭の `https://` を落として書く。落ちているだけで読めないのは、
 * こちらの都合でしかない — **足すのは https**（http には落とさない）。
 */
export const normalize = (raw: string): string => {
  const t = raw.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
};

/** ここへは行かせない、を1か所で決める。**通す理由を書けないものは通さない** */
export function blockedWhy(raw: string, demo = process.env.DEMO_MODE === '1'): string | null {
  let u: URL;
  try { u = new URL(normalize(raw)); } catch { return 'URL の形になっていません'; }

  const local = LOCAL_NAME.test(u.hostname) || privateV4(u.hostname) || privateV6(u.hostname);
  if (u.protocol === 'http:') {
    // **デモと検査のためだけ。** `NODE_ENV` では分けられない（`next start` は検査でも production）
    if (!(demo && local)) return 'https のページだけ読めます';
  } else if (u.protocol !== 'https:') {
    return 'https のページだけ読めます';
  }
  if (local && !demo) return 'そのアドレスは外から見えないところを指しています';
  if (u.username || u.password) return 'URL に利用者名とパスワードは入れられません';
  /**
   * **点の無い名前は断る**（`ほげ` / `db` / `metadata`）。
   * モデルが書いた語がそのまま住所になってしまうし、社内の網では
   * **1語の名前が内側の機械に当たる**（`https://ほげ` を引きに行かせない）。
   *
   * ただし**外から見えないと分かっている名前は、ここでは数えない** —
   * `localhost` は上の2行がもう捌いている（デモのときだけ通す）。
   * ここで断ると、デモで通したはずの `http://localhost:3999` が
   * この行だけで落ちる（**同じことを2か所で決めない**）。
   */
  if (!local && !u.hostname.includes('.') && !u.hostname.startsWith('[')) {
    return 'その住所は読めません（ドメイン名になっていません）';
  }
  if (u.port && !['', '80', '443'].includes(u.port) && !demo) return '既定でない口（ポート）は読めません';
  return null;
}

/** タグを落として本文にする。**記号の山をモデルに渡さない** */
export function textOf(html: string): { title?: string; text: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  const body = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // 段落・見出し・箇条書きは**行を分ける**（全部つながると読めない）
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n・')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .split('\n').map((l) => l.trim()).join('\n')
    .trim();
  return { title: decode(title), text: body };
}

const decode = (s?: string) => s
  ?.replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").trim();

/**
 * 読む。**転送も毎回同じ検査に掛ける**（1回目だけ見て通すと、そこから中へ入れる）。
 * 読めなかったら投げる — 呼ぶ側が、社長に読めなかったと言えるように。
 */
export async function readPage(raw: string, limit = 12_000): Promise<Page> {
  let url = normalize(raw);
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const why = blockedWhy(url);
    if (why) throw new Error(why);

    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'OneFound/1.0 (+https://onefound.app)', Accept: 'text/html,text/plain,*/*;q=0.5' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) throw new Error(`${res.status} で転送されましたが、行き先がありません`);
      url = new URL(next, url).toString();     // **相対でも絶対に直してから**もう一度検査する
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} が返りました`);

    const type = res.headers.get('content-type') ?? '';
    if (!READABLE.test(type)) throw new Error(`この形式は読めません（${type.split(';')[0] || '不明'}）`);

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error('ページが大きすぎます');
    const src = new TextDecoder('utf-8').decode(buf);

    const got = /html|xhtml/i.test(type) ? textOf(src) : { text: src.trim() };
    if (!got.text) throw new Error('本文が空でした');
    return { url, title: got.title, text: got.text.slice(0, limit) };
  }
  throw new Error('転送が多すぎます');
}

/** 歩みに出す短い名前（URL をそのまま出すと行が読めなくなる） */
export function host(raw: string): string {
  try { return new URL(raw).hostname.replace(/^www\./, ''); } catch { return raw.slice(0, 30); }
}
