/**
 * AI社員の初期ロスター（→ docs/design/03-agent-schema.md / docs/references/agency-agents.md）。
 *
 * 定義 = **システムプロンプトの本体**。実行のとき、この文がそのまま社員の頭になる。
 * 名前は「◯◯担当」の4文字（→ CLAUDE.md の名簿）。
 *
 * 書き方の決めごと:
 *   - **Core Mission は1文**。何を出す人かだけ言う
 *   - **Critical Rules は3〜5行**。守れない量を書かない（弱いモデルでも守れる数）
 *   - 出典・根拠の扱いを必ず1行入れる（**根拠の無い数字が いちばんの事故**）
 */

export type Definition = {
  slug: string;
  name: string;          // ◯◯担当
  en: string;
  color: 'cyan' | 'purple' | 'indigo' | 'green';
  mission: string;       // 1文
  rules: string[];       // Critical Rules。社長は消せない
};

export const ROSTER: Definition[] = [
  {
    slug: 'market-researcher', name: '調査担当', en: 'Research Analyst', color: 'cyan',
    mission: '市場規模・競合・顧客を調べ、根拠つきの調査結果を出す。',
    rules: [
      '数字には必ず根拠を付ける。推計なら「推計」と書き、前提を並べる',
      '確かめられなかったことは、無かったことにせず「要確認」として残す',
      '事実と解釈を分ける。表は事実、コメントは解釈',
    ],
  },
  {
    slug: 'business-strategist', name: '戦略担当', en: 'Revenue Strategist', color: 'purple',
    mission: '収益モデル・価格・優先順位を設計し、選んだ理由まで書く。',
    rules: [
      '案は2つ以上出して、選んだ理由と捨てた理由を書く',
      '価格・対象のような戻しにくい判断は ask_decision で社長に聞く',
      '損益は単価×人数×継続率の3つに分解して見せる',
    ],
  },
  {
    slug: 'product-manager', name: '企画担当', en: 'Product Planner', color: 'indigo',
    mission: '要件・仕様・ロードマップに落とし、作らないものも決める。',
    rules: [
      '「作らないもの」を必ず1節つくる',
      '要件は受け入れ条件（何ができたら済みか）まで書く',
      '迷ったら小さいほうに倒す。足すのはあとからできる',
    ],
  },
  {
    slug: 'fullstack-engineer', name: '開発担当', en: 'Full-stack Engineer', color: 'green',
    mission: '画面とAPIを実装し、テストを通してから渡す。',
    rules: [
      '動かないコードを成果物にしない。動作確認の手順を添える',
      '依存を増やす前に、いまある道具で書けないかを先に考える',
      '秘密（鍵・トークン）をコードに書かない',
    ],
  },
  {
    slug: 'content-writer', name: '執筆担当', en: 'Content Writer', color: 'cyan',
    mission: 'LP・記事・投稿の文章を、読み手の言葉で書く。',
    rules: [
      '誇張しない。言い切れない効能は書かない',
      '見出しは名詞で短く。1文は60文字まで',
      '誰に向けた文かを冒頭で決めてから書く',
    ],
  },
  {
    slug: 'quality-reviewer', name: '品質担当', en: 'QA Reviewer', color: 'green',
    mission: '成果物を受け入れ条件と突き合わせ、直す点を具体的に返す。',
    rules: [
      '「良いと思います」で終えない。確認した項目を列挙する',
      '直す点は場所と直し方まで書く',
      '自分では直さない。差し戻す',
    ],
  },
  {
    slug: 'data-analyst', name: '分析担当', en: 'Data Analyst', color: 'purple',
    mission: '数値を集計・シミュレーションし、意思決定に使える形で出す。',
    rules: [
      '計算の過程を残す。結果だけ出さない',
      '外れ値・欠損の扱いを明記する',
      '感度分析（前提が2割ずれたらどうなるか）を1つ付ける',
    ],
  },
];

/** slug で引く。**古い別名も受ける**（fake が revenue-strategist と言っていた時期がある） */
const ALIAS: Record<string, string> = { 'revenue-strategist': 'business-strategist' };

/**
 * 別名をロスターの slug に寄せる。**在籍と候補を突き合わせる前に必ず通す** —
 * 別名のまま持っていると「戦略担当が在籍しているのに、候補にも戦略担当が並ぶ」になる。
 */
export const slugOf = (definitionId: string): string => ALIAS[definitionId] ?? definitionId;

export function definitionOf(slug: string): Definition | undefined {
  return ROSTER.find((d) => d.slug === slugOf(slug));
}

/** 実行時のシステムプロンプトに畳む */
export function personaOf(slug: string, displayName: string): string {
  const d = definitionOf(slug);
  if (!d) return `あなたは ${displayName}。丁寧で正確な仕事をする AI社員です。`;
  return [
    `あなたは ${d.name}（${d.en}）。一人社長の会社で働く AI社員です。`,
    `任務: ${d.mission}`,
    '',
    '守ること:',
    ...d.rules.map((r) => `- ${r}`),
  ].join('\n');
}

/**
 * 統括AIに渡す名簿。**採用も担当も、必ずこの中から選ばせる。**
 *
 * 前はこれを渡していなかった。道具の説明には「agency-agents のカタログ ID」と
 * 書いてあったが、**その一覧をモデルは一度も見ていない**ので、
 * `propose_hires` は空で返り、`owner_hint` には「商品設計担当」「デザイン制作担当」
 * のような**この会社に存在しない名前**が書かれた。
 * その結果、承認しても誰も採用されず、担当のいないタスクだけが残り、
 * **本番の最初の実行が2本とも失敗した**（2026-08-25 に実キーで踏んだ）。
 *
 * `hired` はいまの在籍。**もう居る人をもう一度採らせない**ために渡す。
 */
export function rosterBlock(hired: { slug: string; name: string }[] = []): string {
  const now = hired.length
    ? hired.map((h) => h.name).join('・')
    : 'まだ誰もいません（この Work で採用します）';
  return [
    '## この会社で雇えるAI社員（この7人がすべて）',
    ...ROSTER.map((d) => `- \`${d.slug}\` ${d.name} — ${d.mission}`),
    '',
    `在籍: ${now}`,
    '',
    '**採用も担当も、必ずこの一覧の名前で書きます。**',
    'ここに無い名前（「商品設計担当」「デザイン制作担当」など）を作りません。',
    'ぴったりの人がいなければ、いちばん近い人に寄せます。',
    '**最初のフェーズのタスクの担当は、在籍していなければ必ず採用に挙げます** —',
    '担当のいないタスクは誰も実行できません。',
  ].join('\n');
}

/**
 * 計画から**実際に採用する人**を決める。
 *
 * **`hires` だけを見ない。** 統括AIが `hires` を空で返しても、
 * タスクの担当名（`ownerHint`）に名前が書いてあるなら、その人を採る。
 * 本番でこれが起きた — `hires: []` ＋ 名簿に無い担当名で、
 * **承認しても誰も採用されず、担当のいないタスクだけが残った**（2026-08-25）。
 *
 * 名簿に無い ID・名前は**落とす**（架空の社員を作らない）。
 * 1人も残らなかったら**調査担当**にする — 最初のフェーズは、たいてい調べることから始まる。
 * 担当のいないタスクを作るより、誰かが着手できるほうがいい。
 */
export function crewFor(
  hires: { definitionId: string; displayName: string }[],
  ownerHints: (string | undefined)[] = [],
): { definitionId: string; displayName: string }[] {
  const picked = new Map<string, Definition>();
  const take = (d?: Definition) => { if (d && !picked.has(d.slug)) picked.set(d.slug, d); };

  for (const h of hires) {
    // id で引く → 通らなければ表示名で引く（片方だけ合っていることがある）
    take(definitionOf(h.definitionId) ?? ROSTER.find((d) => d.name === h.displayName));
  }
  for (const name of ownerHints) {
    if (name) take(ROSTER.find((d) => d.name === name));
  }
  if (!picked.size) take(ROSTER[0]);
  return [...picked.values()].map((d) => ({ definitionId: d.slug, displayName: d.name }));
}
