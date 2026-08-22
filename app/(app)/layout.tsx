import { Rail } from '@/components/shell/Rail';
import { Shell } from '@/components/shell/Shell';

/** 3ペイン。左＝ナビ＋チャット履歴、中＝主役、右＝閉じた状態から始まるパネル */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <div style={{ display: 'flex', height: '100vh', background: '#000', overflow: 'hidden' }}>
        <Rail />
        {children}
      </div>
    </Shell>
  );
}
