'use client';

import { Suspense } from 'react';
import { useParam } from '@/lib/use-open';
import { Composer, Pills, TopBar } from '@/components/shell/Chrome';
import { Dot, Icon } from '@/components/ui/Icon';
import { EMPLOYEES, FLOW } from '@/lib/dummy';
import { Office } from '@/components/home/Office';
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

/** 盤面2つ（オフィス / ワークフロー）は同じ器。見出しの1行 ＋ 1148×760 の盤面 */
function Canvas({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px 0',
    }}>
      <div style={{
        width: '100%', maxWidth: 1148, flex: 1, minHeight: 0, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 0',
      }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, height: 20 }}>{head}</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>{children}</div>
      </div>
    </div>
  );
}

/** オフィスの見出し。**本当に動く**ので、動いている数をそのまま出す */
function Head() {
  const running = EMPLOYEES.filter((e) => e.state === '実行中').length;
  return (
    <>
      <span style={{ color: '#6E6E6E' }}>オフィス</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#5F5F5F', fontSize: 12 }}>
        <Dot color="#1E8E3E" size={6} /> リアルタイム
      </span>
      <div style={{ flex: 1 }} />
      <span style={{ color: '#6E6E6E', fontSize: 12 }} className="tnum">稼働 {running} / {EMPLOYEES.length}</span>
    </>
  );
}

function Home() {
  const [view, setView] = useParam('view', 'office');
  const canvas = view === 'office' || view === 'flow';

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title="ホーム" />

      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '16px 0 0' }}>
        <Pills items={VIEWS} active={view} onPick={setView} />
      </div>

      {/* 切り替えたときは、次の面がふわっと出る（key を変えて描き直す） */}
      <div key={view} className="rise" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {canvas ? (
          <Canvas head={view === 'office' ? <Head/> : <span style={{ color: '#6E6E6E' }}>{FLOW.caption}</span>}>
            {view === 'office' ? <Office /> : <Flow />}
          </Canvas>
        ) : view === 'desk' ? <Desk /> : <Progress />}
      </div>

      <Composer placeholder="統括AIに指示する" />
    </div>
  );
}

/** ビューは URL に持つ（見せたい画面をそのまま渡せるように） */
export default function HomePage() {
  return <Suspense><Home /></Suspense>;
}
