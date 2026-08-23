'use client';

import { Suspense, useState } from 'react';
import { useParam } from '@/lib/use-open';
import { Composer, Pills, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { COMPOSER_H } from '@/lib/design/tokens';
import { Office } from '@/components/home/Office';
import { OfficeLog, OfficeTeam } from '@/components/home/OfficeSides';
import { Desk } from '@/components/home/Desk';
import { Progress } from '@/components/home/Progress';
import { Flow } from '@/components/home/Flow';

/** ホームだけ右ペインなしの全幅。上部ピルで4ビュー切替 */
const VIEWS = [
  { key: 'office',   label: 'オフィス',     icon: <Icon name="team" size={14} /> },
  { key: 'desk',     label: 'デスク',       icon: <Icon name="panel" size={14} /> },
  { key: 'progress', label: '進捗',         icon: <Icon name="check" size={14} /> },
  { key: 'flow',     label: 'ワークフロー', icon: <Icon name="roadmap" size={14} /> },
];

/**
 * オフィス。上＝絵とログ / 下＝AI社員。
 * **絵とログの段が余りを全部取る**（下に空白を残さない。絵は与えられた面いっぱいに描く）。
 * **下に貼り付く社員の行は `COMPOSER_H` ぶん逃がす**（入力欄はその上に浮く）。
 *
 * **絵と一覧は対。** 絵の中の球に指が乗ったら下の一覧の同じ人が明るくなる（その逆も）。
 * 絵そのものは行き先を持たない — 見ている目を別の画面へ飛ばさない。
 */
function OfficeView() {
  const [lit, setLit] = useState('');
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 30px 0' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 22, alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <Office lit={lit} onHover={setLit} />
        </div>
        <OfficeLog />
      </div>
      <div style={{ flexShrink: 0, marginBottom: COMPOSER_H }}>
        <OfficeTeam lit={lit} onHover={setLit} />
      </div>
    </div>
  );
}

/**
 * ワークフロー。**盤面を箱に収めるのをやめて、中身の領域いっぱいに広げる。**
 * ピルも入力欄もその上に浮く（「入る大きさに縮める」は要らなくなった）。
 */
function FlowView() {
  return <div style={{ flex: 1, minHeight: 0, position: 'relative' }}><Flow /></div>;
}

function Home() {
  const [view, setView] = useParam('view', 'office');
  const bleed = view === 'flow';

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title="ホーム" />

      {/* 盤面のときはピルも絵の上に浮かせる（画面いっぱいにするため） */}
      <div style={{
        flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '16px 0 0',
        ...(bleed ? { position: 'absolute' as const, left: 0, right: 0, top: 44, zIndex: 2 } : null),
      }}>
        <Pills items={VIEWS} active={view} onPick={setView} />
      </div>

      {/* 切り替えたときは、次の面がふわっと出る（key を変えて描き直す） */}
      <div key={view} className="rise" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'office' ? <OfficeView />
          : view === 'flow' ? <FlowView />
          : view === 'desk' ? <Desk /> : <Progress />}
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
