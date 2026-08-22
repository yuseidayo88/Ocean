import { Rail } from '@/components/shell/Rail';
import { Shell } from '@/components/shell/Shell';
import { SHELL_MIN } from '@/lib/design/tokens';

/** 3ペイン。左＝ナビ＋チャット履歴、中＝主役、右＝閉じた状態から始まるパネル */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <div style={{ height: '100vh', background: '#000', overflowX: 'auto', overflowY: 'hidden' }}>
        {/* 狭い窓では中身を潰さず、窓のほうを横に滑らせる */}
        <div style={{ display: 'flex', height: '100%', minWidth: SHELL_MIN }}>
          <Rail />
          {children}
        </div>
      </div>
    </Shell>
  );
}
