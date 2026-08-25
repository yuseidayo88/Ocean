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
export function gateNote(phase: string, gate: boolean, unseen: number): { kind: string; body: string } {
  if (unseen) {
    return {
      kind: '要確認',
      body: `フェーズ「${phase}」が終わりました。成果物 ${unseen}件 を見て、次に進めてください`,
    };
  }
  if (gate) {
    return { kind: '判断待ち', body: `フェーズ「${phase}」が終わりました。決めて、次に進めてください` };
  }
  return { kind: '要確認', body: `フェーズ「${phase}」が終わりました。次に進みます` };
}
