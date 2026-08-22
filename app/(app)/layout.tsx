import { Rail } from '@/components/shell/Rail';
import { Shell, ShellBox } from '@/components/shell/Shell';
import { ChatPane } from '@/components/shell/ChatPane';

/** 3ペイン。左＝ナビ＋チャット履歴、中＝主役、右＝閉じた状態から始まるパネル */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <ShellBox>
        <Rail />
        {children}
        {/* 統括AIとの会話。**どの画面からでも開く**ので、ここに1つだけ置く */}
        <ChatPane />
      </ShellBox>
    </Shell>
  );
}
