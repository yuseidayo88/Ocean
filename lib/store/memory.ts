import { AGENT_COLOR, type EmployeeColor } from '@/lib/dummy';
import type { DraftWork, LiveWork, Store } from './types';

/**
 * メモリの保存先。**Supabase に出られない環境（デモ・この開発環境）用。**
 * プロセスが死ぬと消える。それでいい — 本物は Supabase のほう。
 *
 * **Supabase 版と同じ順序で同じことをする。** 片方だけで通る道を作らない
 * （デモで動いたものが本番で落ちる、が起きる）。
 *
 * 開発中の hot reload で作り直されないように、グローバルに置く。
 */
const g = globalThis as unknown as { __drafts?: Map<string, Row> };

type Row = DraftWork & { live?: LiveWork };
const bag = (g.__drafts ??= new Map<string, Row>());

let n = 0;

/** 提案した社員に色を配る。**定義 id からいつも同じ色になる**（開き直すたびに変わらない） */
const WHEEL: EmployeeColor[] = ['cyan', 'purple', 'indigo', 'green'];
export const colorFor = (definitionId: string, i: number): EmployeeColor =>
  WHEEL[(definitionId.length + i) % WHEEL.length];

/** 承認したあとの姿を、控えから組み立てる（Supabase 版の SELECT と同じ形） */
function live(d: DraftWork): LiveWork {
  return {
    id: d.id, title: d.title, goal: d.goal, status: 'active',
    phases: d.plan.phases.map((p, i) => ({
      id: `${d.id}-p${i + 1}`, seq: i + 1, name: p.name, goal: p.goal,
      state: i === 0 ? 'active' : 'planned',
    })),
    tasks: d.plan.firstPhaseTasks.map((t, i) => ({
      id: `${d.id}-t${i + 1}`, phaseId: `${d.id}-p1`, title: t.title, intent: t.intent,
      state: 'queued', owner: d.hires[0]?.displayName,
    })),
    crew: d.hires.map((h, i) => ({
      id: `${d.id}-e${i + 1}`, name: h.displayName, color: AGENT_COLOR[colorFor(h.definitionId, i)],
    })),
    startedAt: new Date().toISOString(),
  };
}

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

  async approve(id) {
    const d = bag.get(id);
    if (!d) throw new Error('その計画は見つかりませんでした');
    if (d.approved) return;                      // 二度押しは何もしない
    bag.set(id, { ...d, approved: true, live: live(d) });
  },

  async revise(id, next) {
    const d = bag.get(id);
    if (!d) throw new Error('その計画は見つかりませんでした');
    if (d.approved) throw new Error('もう承認された計画は直せません');
    bag.set(id, { ...next, id, createdAt: d.createdAt });
  },

  async getWork(id) { return bag.get(id)?.live ?? null; },
};
