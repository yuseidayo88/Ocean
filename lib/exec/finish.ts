/**
 * **Work が終わったときに言うこと**（2026-08-25）。
 *
 * 前は `works.status = 'done'` にして「Work が終わりました」の1行だけだった。
 * それは記録であって、報告ではない — 何ができたのかも、何を決めたのかも入っていない。
 * 「チャットボットは聞かれるまで黙っている。**会社は先に言う**」と言っている以上、
 * 終わりこそいちばん言うべきところ。
 *
 * **言葉は1か所に置く**（双子のストアが同じ文を書く）。
 * モデルは呼ばない — ここに書くのは**事実だけ**なので、組み立てで足りる（朝の報告と同じ）。
 */

export type Finished = {
  title: string;
  /** できたもの（新しい順） */
  dels: string[];
  /** そのうち、まだ社長が見ていないもの */
  unseen: number;
  /** 決めたこと（決まっているものだけ） */
  decisions: { question: string; chosen: string }[];
};

/** 通知の1行。**片づける場所に出る**ので、短く事実だけ */
export function finishNote(f: Finished): string {
  const parts = [`成果物 ${f.dels.length}件`];
  if (f.decisions.length) parts.push(`決めたこと ${f.decisions.length}件`);
  if (f.unseen) parts.push(`まだ見ていないものが ${f.unseen}件`);
  return `Work「${f.title}」が終わりました — ${parts.join('、')}`;
}

/**
 * 会話に置く統括AIの発言。**1チャット = 1 Work** なので、
 * その Work を始めた会話にそのまま続く（→ `chat_threads.work_id`）。
 */
export function finishSay(f: Finished): string {
  const lines = [`**「${f.title}」が終わりました。**`, ''];
  if (f.dels.length) {
    lines.push(`できたもの ${f.dels.length}件`);
    for (const d of f.dels.slice(0, 6)) lines.push(`- ${d}`);
    if (f.dels.length > 6) lines.push(`- ほか ${f.dels.length - 6}件`);
    lines.push('');
  }
  if (f.decisions.length) {
    lines.push(`決めたこと ${f.decisions.length}件`);
    for (const d of f.decisions.slice(0, 6)) lines.push(`- ${d.question} → ${d.chosen}`);
    lines.push('');
  }
  // **まだ見ていないものは、そう言う。**「すべて揃いました」と言わない
  if (f.unseen) lines.push(`まだ見ていない成果物が ${f.unseen}件 あります。`);
  return lines.join('\n').trim();
}

/**
 * **フェーズが終わったときに言うこと。**
 *
 * 待つものは2つあって、言い方が違う（→ CLAUDE.md「言葉」）——
 * **判断待ち＝あなたが決める** ／ **要確認＝あなたが成果物を見る**。
 * どちらも無ければ会社が自分で進むので、そう言って進む。
 *
 * 成果物のほうが先に来る。◆ は「見たうえで決める」ことなので、
 * 見ていないものが残っているうちは、決めろとは言わない。
 */
/**
 * **見込みと、実際にかかった日数**（2026-08-26。社長の「あとは何が不足してる？」で見つけた）。
 *
 * 週数は統括AIが計画のときに書き、社長が承認する。ところが
 * **誰も守らないし、ずれても誰も言わなかった** — 画面のどこかに「遅れ N日」が出るだけで、
 * それが**何と比べた数字なのかも、どこにも書いていなかった**。
 *
 * 比べる先は**承認したときの見込み**（それ以外に基準は無い）。
 * **モデルは呼ばない** — 起きた事実の引き算なので、組み立てで足りる（朝の報告と同じ）。
 * **1日未満のずれは言わない**（毎回言うと、言葉が軽くなる）。
 */
export function paceSay(
  weeks: number | undefined,
  startedAt: string | undefined,
  doneAt: string | undefined,
): string {
  if (!weeks || !startedAt || !doneAt) return '';       // 無いものは無いと出す
  const days = (new Date(doneAt).getTime() - new Date(startedAt).getTime()) / 86400000;
  if (!Number.isFinite(days) || days < 0) return '';
  const planned = weeks * 7;
  const diff = Math.round(days - planned);
  if (Math.abs(diff) < 1) return `見込みどおり（${weeks}週）`;
  return diff > 0
    ? `見込み ${weeks}週 のところ ${diff}日 かかりました`
    : `見込み ${weeks}週 より ${-diff}日 早く終わりました`;
}

export function gateNote(
  phase: string, gate: boolean, unseen: number, pace = '',
): { kind: string; body: string } {
  // **遅れは、閉じたその場で言う。** 画面のどこかに出るのを見つけてもらうのではなく
  const tail = pace ? `（${pace}）` : '';
  if (unseen) {
    return {
      kind: '要確認',
      body: `フェーズ「${phase}」が終わりました${tail}。成果物 ${unseen}件 を見て、次に進めてください`,
    };
  }
  if (gate) {
    return { kind: '判断待ち', body: `フェーズ「${phase}」が終わりました${tail}。決めて、次に進めてください` };
  }
  return { kind: '要確認', body: `フェーズ「${phase}」が終わりました${tail}。次に進みます` };
}
