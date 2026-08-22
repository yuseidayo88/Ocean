import { Rail } from '@/components/shell/Rail';

/** 3ペイン。左＝ナビ＋チャット履歴、中＝主役、右＝タブで開くもの */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#000', overflow: 'hidden' }}>
      <Rail />
      {children}
    </div>
  );
}
