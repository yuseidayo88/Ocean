import { blockedWhy } from '@/lib/web/fetch';

/**
 * **MCP の OAuth**（2026-08-27。社長の「他のやつから順に」の②）。
 *
 * ここまで、つなぐには**鍵を手で貼る**しかなかった。
 * Notion や GitHub の鍵を自分で作って貼れる社長はまずいない —
 * 「MCP は入っている」と言いながら、**実際には誰も使えない**状態だった。
 *
 * ## 通る道（本物の MCP サーバーと同じ順）
 *
 * 1. 鍵なしで話しかける → **401 が入口を教える**（`WWW-Authenticate` の
 *    `resource_metadata`。RFC 9728）
 * 2. そこを読むと**認可サーバー**が分かる → その素性を読む（RFC 8414）
 * 3. **その場で客として登録する**（RFC 7591 の動的登録）。
 *    こちらは相手ごとに事前登録できないので、これが無いと繋げない
 * 4. **PKCE つきで**社長を認可の画面へ送る（S256。鍵を配らない公開クライアント）
 * 5. 戻ってきた符号を引き換える → access / refresh
 *
 * ## 決めごと
 *
 * - **鍵は行って戻らない。** ここで扱うものは全部サーバーの中だけ
 *   （`McpServer` の型には出さない → `lib/mcp/types.ts`）
 * - **行き先は毎回断りの検査に掛ける**（`blockedWhy`）。認可サーバーの住所を
 *   決めるのは**相手のサーバー**なので、こちらの手の内ではない —
 *   `169.254.169.254` を指されたら中が読まれる（→ `docs/design/15-reading.md`）
 * - **倒れない。** 相手は他人のサーバー。失敗は文字で返して社長に読ませる
 */

export type AuthServer = {
  issuer: string;
  authorize: string;
  token: string;
  register?: string;
  /** 相手が S256 を受けるか。**受けないなら繋がない**（PKCE 無しでは通さない） */
  s256: boolean;
};

/** つなぐ先の素性。`resource` は引き換えのときに添える（RFC 8707） */
export type Discovered = { as: AuthServer; resource: string };

const JSON_MS = 10_000;

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const why = blockedWhy(url);
  if (why) throw new Error(`認可サーバーの住所が読めません（${why}）`);
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(JSON_MS),
  });
  if (!res.ok) return null;
  return await res.json() as Record<string, unknown>;
}

/** 401 のヘッダから、素性の場所を取り出す */
export function metadataUrl(header: string | null): string | null {
  if (!header) return null;
  return /resource_metadata\s*=\s*"([^"]+)"/i.exec(header)?.[1] ?? null;
}

/**
 * その MCP が OAuth を求めているか、求めているならどこへ行けばいいかを調べる。
 * **求めていなければ null**（鍵も要らない相手は、そのまま繋がる）。
 */
export async function discover(mcpUrl: string): Promise<Discovered | null> {
  const why = blockedWhy(mcpUrl);
  if (why) throw new Error(why);

  // 鍵なしで1回叩いて、401 が入口を教えてくれるかを見る
  const probe = await fetch(mcpUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    signal: AbortSignal.timeout(JSON_MS),
  }).catch(() => null);
  if (!probe || probe.status !== 401) return null;

  const origin = new URL(mcpUrl).origin;
  // **ヘッダが正解。** 無いサーバーもあるので、決まりの場所も見に行く
  const prmUrl = metadataUrl(probe.headers.get('www-authenticate'))
    ?? `${origin}/.well-known/oauth-protected-resource`;
  const prm = await getJson(prmUrl);
  const issuer = String((prm?.authorization_servers as string[] | undefined)?.[0] ?? origin);
  const resource = String(prm?.resource ?? mcpUrl);

  // 認可サーバーの素性。`oauth-authorization-server` → 無ければ OpenID の場所
  const meta = await getJson(`${issuer.replace(/\/$/, '')}/.well-known/oauth-authorization-server`)
    ?? await getJson(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`);
  if (!meta?.authorization_endpoint || !meta?.token_endpoint) {
    throw new Error('認可サーバーの素性が読めませんでした');
  }
  const methods = (meta.code_challenge_methods_supported as string[] | undefined) ?? [];
  return {
    resource,
    as: {
      issuer: String(meta.issuer ?? issuer),
      authorize: String(meta.authorization_endpoint),
      token: String(meta.token_endpoint),
      register: meta.registration_endpoint ? String(meta.registration_endpoint) : undefined,
      // **書いていなければ S256 を前提にする**（OAuth 2.1 の既定）
      s256: methods.length === 0 || methods.includes('S256'),
    },
  };
}

/** その場で客として登録する。**鍵を配らない相手なら client_secret は返らない** */
export async function register(as: AuthServer, redirectUri: string, appName = 'OneFound')
  : Promise<{ clientId: string; clientSecret?: string }> {
  if (!as.register) throw new Error('この相手は、その場での登録を受け付けていません');
  const why = blockedWhy(as.register);
  if (why) throw new Error(`登録の住所が読めません（${why}）`);
  const res = await fetch(as.register, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: appName,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
    signal: AbortSignal.timeout(JSON_MS),
  });
  if (!res.ok) throw new Error(`登録できませんでした（${res.status}）`);
  const got = await res.json() as { client_id?: string; client_secret?: string };
  if (!got.client_id) throw new Error('client_id が返りませんでした');
  return { clientId: got.client_id, clientSecret: got.client_secret };
}

/** PKCE の verifier（43〜128文字）。**推測できないもの** */
export function verifier(): string {
  const b = crypto.getRandomValues(new Uint8Array(48));
  return b64url(b);
}

export async function challenge(v: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return b64url(new Uint8Array(hash));
}

function b64url(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 社長を送る先 */
export function authorizeUrl(a: {
  as: AuthServer; clientId: string; redirectUri: string; challenge: string;
  state: string; resource: string;
}): string {
  const u = new URL(a.as.authorize);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', a.clientId);
  u.searchParams.set('redirect_uri', a.redirectUri);
  u.searchParams.set('code_challenge', a.challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('state', a.state);
  // **どの資源のための鍵か**を言う（RFC 8707）。MCP はこれを求める
  u.searchParams.set('resource', a.resource);
  return u.toString();
}

export type Tokens = { access: string; refresh?: string; expiresAt?: string };

async function post(url: string, form: URLSearchParams, secret?: string): Promise<Tokens> {
  const why = blockedWhy(url);
  if (why) throw new Error(`引き換えの住所が読めません（${why}）`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
      ...(secret ? { authorization: `Basic ${btoa(`${form.get('client_id')}:${secret}`)}` } : {}),
    },
    body: form,
    signal: AbortSignal.timeout(JSON_MS),
  });
  const got = await res.json().catch(() => ({})) as
    { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !got.access_token) {
    throw new Error(got.error_description ?? got.error ?? `引き換えできませんでした（${res.status}）`);
  }
  return {
    access: got.access_token,
    refresh: got.refresh_token,
    expiresAt: got.expires_in
      ? new Date(Date.now() + got.expires_in * 1000).toISOString()
      : undefined,
  };
}

/** 戻ってきた符号を引き換える */
export const exchange = (a: {
  tokenUrl: string; code: string; verifier: string; clientId: string;
  clientSecret?: string; redirectUri: string; resource: string;
}) => post(a.tokenUrl, new URLSearchParams({
  grant_type: 'authorization_code',
  code: a.code,
  code_verifier: a.verifier,
  client_id: a.clientId,
  redirect_uri: a.redirectUri,
  resource: a.resource,
}), a.clientSecret);

/** 切れる前に取り直す */
export const renew = (a: {
  tokenUrl: string; refresh: string; clientId: string; clientSecret?: string; resource: string;
}) => post(a.tokenUrl, new URLSearchParams({
  grant_type: 'refresh_token',
  refresh_token: a.refresh,
  client_id: a.clientId,
  resource: a.resource,
}), a.clientSecret);
