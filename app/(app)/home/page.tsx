'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParam } from '@/lib/use-open';
import { homeData } from '@/app/actions/home';
import type { HomeData } from '@/lib/live/home';
import { Composer, Pills, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { Go as Link } from '@/components/ui/Go';
import { AMBER_T, COMPOSER_H, RED_T } from '@/lib/design/tokens';
import { Office } from '@/components/home/Office';
import { OfficeLog, OfficeTeam } from '@/components/home/OfficeSides';
import { Desk } from '@/components/home/Desk';
import { Flow } from '@/components/home/Flow';

/**
 * ホームだけ右ペインなしの全幅。上部ピルでビュー切替。
 *
 * **進捗は畳んだ**（2026-08-26。社長の「てかこの画面いる？」）。
 * あれが「ここにしか無いもの」として持っていたのは**日付だけ**で、
 * 進み具合も判断待ちも予定との差も、**オフィスの輪がすでに言っている**
 * （輪そのものが進捗の計器で、赤い点線が予定との差、橙の菱形が判断待ち）。
 * 日付は Work 画面のフェーズの行へ移した — 会社ぜんぶのカレンダーは、
 * 誰も守っていない見積り（計画の週数）を「遅れ N日」と言い切ることになっていた。
 *
 * **いちばん価値があったのは答えの1行**（判断待ち / 要確認 / 遅れ）なので、
 * それはビューの外に出して**どのタブでも見える**ようにした。
 */
const VIEWS = [
  { key: 'office',   label: 'オフィス',     icon: <Icon name="team" size={14} /> },
  { key: 'desk',     label: 'デスク',       icon: <Icon name="panel" size={14} /> },
  { key: 'flow',     label: 'ワークフロー', icon: <Icon name="roadmap" size={14} /> },
];

/**
 * **社長を待っているもの。** ビューの外に置く（2026-08-26）——
 * これは進捗の画面でいちばん価値のあった1行で、
 * **タブを選ばないと見えない**のがそもそもおかしかった。
 *
 * **出すのは放っておけないときだけ**（→ CLAUDE.md「数えた件数を出すのは、
 * 放っておけないもの（判断待ち・要確認）だけ」）。無いときは何も置かない —
 * 「ありません」と書くのは、無いことを1行ぶん使って言うことになる。
 */
function Waiting({ data }: { data: HomeData }) {
  const { gates, review, late, stuck } = data;
  /**
   * ◆ の名前は**それだけのときに**出す。ほかにも待っているものがあるなら数だけ —
   * 並べるとピルにぶつかるし、そもそも名前が要るのは「あと1つ」のときだけ。
   */
  const one = gates === 1 && !review && !late && !stuck ? data.works.find((w) => w.gate)?.gate?.label : '';
  // **枠は必ず出す**（3列の1つめ。消すとピルが真ん中でなくなる）。中身だけ空にする
  return (
    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 16, overflow: 'hidden' }}>
      {/**
        * **止まっているのがいちばん先**（2026-08-26）。判断待ちも要確認も「あなたの番」だが、
        * 止まっている Work は**誰の番でもなく、放っておくと永久に動かない**。
        * 前はここに何も出ておらず、会社が死んでいても絵はいつもどおり回っていた。
        */}
      {stuck > 0 && (
        <Link href="/tasks" className="lnk" style={{ color: RED_T, fontSize: 13, whiteSpace: 'nowrap' }}>
          {stuck}つが止まっています ›
        </Link>
      )}
      {late > 0 && (
        <span style={{ color: RED_T, fontSize: 13, whiteSpace: 'nowrap' }}>
          {late}つが遅れています
        </span>
      )}
      {gates > 0 && (
        <Link href="/decisions" className="lnk" style={{ color: AMBER_T, fontSize: 13, whiteSpace: 'nowrap' }}>
          判断待ちが {gates}件{one ? ` — ${one}` : ''} ›
        </Link>
      )}
      {review > 0 && (
        <Link href="/deliverables" className="lnk" style={{ color: AMBER_T, fontSize: 13, whiteSpace: 'nowrap' }}>
          成果物 {review}件 を見る ›
        </Link>
      )}
    </div>
  );
}

/**
 * オフィス。上＝絵とログ / 下＝AI社員。
 * **絵とログの段が余りを全部取る**（下に空白を残さない。絵は与えられた面いっぱいに描く）。
 * **下に貼り付く社員の行は `COMPOSER_H` ぶん逃がす**（入力欄はその上に浮く）。
 *
 * **絵と一覧は対。** 絵の中の球に指が乗ったら下の一覧の同じ人が明るくなる（その逆も）。
 * 絵そのものは行き先を持たない — 見ている目を別の画面へ飛ばさない。
 */
function OfficeView({ data }: { data: HomeData }) {
  const [lit, setLit] = useState('');
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 30px 0' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 22, alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <Office works={data.works} lit={lit} onHover={setLit} />
        </div>
        <OfficeLog events={data.events} running={data.staff.filter((x) => x.state === '実行中').length} />
      </div>
      <div style={{ flexShrink: 0, marginBottom: COMPOSER_H }}>
        <OfficeTeam staff={data.staff} works={data.works.length} gates={data.gates}
          exec={data.exec} lit={lit} onHover={setLit} />
      </div>
    </div>
  );
}

/**
 * ワークフロー。**盤面を箱に収めるのをやめて、中身の領域いっぱいに広げる。**
 * ピルも入力欄もその上に浮く（「入る大きさに縮める」は要らなくなった）。
 */
function FlowView({ data }: { data: HomeData }) {
  return <div style={{ flex: 1, minHeight: 0, position: 'relative' }}><Flow map={data.map} /></div>;
}

function Home() {
  const [view, setView] = useParam('view', 'office');
  const bleed = view === 'flow';
  const router = useRouter();

  /**
   * ホームは store から1本で読む（→ homeData）。
   * **Work が1つも無い会社は、はじめての画面がホーム** — 空の盤面を見せない。
   */
  const [data, setData] = useState<HomeData | null>(null);
  /**
   * **オフィスは生きている。** 会社は見ているあいだも動く（器のポンプ）ので、
   * 1回読んで固まったままだと、絵とログが**止まった写真**になる。
   *
   * 8秒ごとに読み直し、**中身が本当に変わったときだけ**入れ替える
   * （変わっていないのに state を差し替えると、輪も粒も毎回組み直しになる）。
   * 裏タブでは読まない。
   */
  useEffect(() => {
    let on = true, timer = 0, last = '';
    const pull = async (first = false) => {
      if (first || !document.hidden) {
        try {
          const d = await homeData();
          if (!on) return;
          if (first && d.works.length === 0 && d.staff.length === 0) { router.replace('/start'); return; }
          const now = JSON.stringify(d);
          if (now !== last) { last = now; setData(d); }
        } catch { /* 次の回でまた読む */ }
      }
      if (on) timer = window.setTimeout(pull, 8000);
    };
    void pull(true);
    return () => { on = false; window.clearTimeout(timer); };
  }, [router]);

  if (!data) {
    return (
      <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
        <TopBar title="ホーム" />
        <div style={{ flex: 1 }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title="ホーム" />

      {/* 盤面のときはピルも絵の上に浮かせる（画面いっぱいにするため）。
          **放っておけないことは、ピルの左に、どのビューでも出す** */}
      {/* **3列**（帯 / ピル / 空）。ピルは真ん中に、帯は左で本当に切れる —
          浮かせて重ねると、帯が伸びたときにピルにぶつかる */}
      <div style={{
        flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', gap: 16, minHeight: 34, padding: '16px 30px 0',
        ...(bleed ? { position: 'absolute' as const, left: 0, right: 0, top: 44, zIndex: 2 } : null),
      }}>
        <Waiting data={data} />
        <Pills items={VIEWS} active={view} onPick={setView} />
        <span />
      </div>

      {/* 切り替えたときは、次の面がふわっと出る（key を変えて描き直す） */}
      <div key={view} className="rise" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'flow' ? <FlowView data={data} />
          : view === 'desk' ? <Desk lanes={data.lanes} idle={data.idle} />
          : <OfficeView data={data} />}
      </div>

      {/* 盤面は中身が入力欄の上に収まっていて潜らない。**黒に溶かすとドットを切るだけ** */}
      <Composer placeholder="統括AIに指示する" veil={!bleed} />
    </div>
  );
}

/** ビューは URL に持つ（見せたい画面をそのまま渡せるように） */
export default function HomePage() {
  return <Suspense><Home /></Suspense>;
}
