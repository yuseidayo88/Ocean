'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Composer, Pills, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
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

function Home() {
  const router = useRouter();
  const sp = useSearchParams();
  const view = sp.get('view') ?? 'office';
  const setView = (k: string) => router.replace(k === 'office' ? '/home' : `/home?view=${k}`);
  const canvas = view === 'office' || view === 'flow';

  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title="ホーム" />

      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '16px 0 0' }}>
        <Pills items={VIEWS} active={view} onPick={setView} />
      </div>

      {canvas ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
          {view === 'office' ? <Office /> : <Flow />}
        </div>
      ) : view === 'desk' ? <Desk /> : <Progress />}

      <Composer placeholder="統括AIに指示する" />
    </div>
  );
}

/** ビューは URL に持つ（見せたい画面をそのまま渡せるように） */
export default function HomePage() {
  return <Suspense><Home /></Suspense>;
}
