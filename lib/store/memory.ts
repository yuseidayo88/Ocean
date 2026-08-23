import type { DraftWork, Store } from './types';

/**
 * メモリの保存先。**Supabase に出られない環境（デモ・この開発環境）用。**
 * プロセスが死ぬと消える。それでいい — 本物は Supabase のほう。
 *
 * 開発中の hot reload で作り直されないように、グローバルに置く。
 */
const g = globalThis as unknown as { __drafts?: Map<string, DraftWork> };
const bag = (g.__drafts ??= new Map<string, DraftWork>());

let n = 0;

export const memoryStore: Store = {
  kind: 'memory',
  async createDraft(d) {
    const id = `w-${Date.now().toString(36)}-${++n}`;
    bag.set(id, { ...d, id, createdAt: new Date().toISOString() });
    return id;
  },
  async getDraft(id) { return bag.get(id) ?? null; },
  async listDrafts() { return [...bag.values()].reverse(); },
  async answer(id, index, answer) {
    const d = bag.get(id);
    if (!d?.questions[index]) return;
    d.questions[index] = { ...d.questions[index], answer };
  },
};
