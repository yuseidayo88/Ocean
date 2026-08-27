import { store } from '@/lib/store';
import { renew } from './oauth';

/**
 * **呼ぶ直前に、通る鍵を1本用意する**（2026-08-27）。
 *
 * 貼った鍵（`token`）はそのまま。OAuth の鍵は**切れる**ので、
 * 切れていたら（切れる前でも）更新して、書き戻してから渡す。
 *
 * **失敗しても倒れない。** 鍵が用意できなければ `undefined` を返し、
 * 相手が 401 を返して「繋がりませんでした」として一覧に残る —
 * **使えるふりをしない**が、1つのせいで仕事が止まることもない。
 */

/** 切れる少し前から取り直す（呼んでいる最中に切れると、そこで失敗する） */
const EARLY_MS = 60_000;

export async function tokenFor(id: string): Promise<string | undefined> {
  const s = store();
  const a = await s.mcpAuth(id).catch(() => null);
  if (!a) return await s.mcpSecret(id).catch(() => undefined);
  if (a.kind !== 'oauth') return a.access;

  const alive = a.access
    && (!a.expiresAt || new Date(a.expiresAt).getTime() - EARLY_MS > Date.now());
  if (alive) return a.access;

  // 切れている。**更新の口があるときだけ**取り直す
  if (!a.refresh || !a.tokenUrl || !a.clientId) return a.access;
  try {
    const got = await renew({
      tokenUrl: a.tokenUrl, refresh: a.refresh, clientId: a.clientId,
      clientSecret: a.clientSecret, resource: a.resource ?? '',
    });
    await s.setMcpAuth(id, {
      access: got.access,
      // **返ってこなければ前のを残す**（消すと次から更新できなくなる）
      ...(got.refresh ? { refresh: got.refresh } : {}),
      expiresAt: got.expiresAt,
    });
    return got.access;
  } catch {
    return a.access;        // 取り直せなかった。相手に断ってもらう
  }
}
