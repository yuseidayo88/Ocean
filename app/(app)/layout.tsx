import { Rail } from '@/components/shell/Rail';
import { Shell, ShellBox } from '@/components/shell/Shell';
import { ChatPane } from '@/components/shell/ChatPane';
import { Find, Note } from '@/components/shell/Find';

/**
 * **統括AIの返事を待てる長さにする。**
 * 計画を立てるのは1往復で道具を5つ書かせる仕事なので、モデルによっては1分近くかかる
 * （Ox Alpha の実測は p50 5秒・p90 35秒・p99 96秒）。
 * 既定の実行時間だと、考えている途中で切られて「応えませんでした」になる。
 * Vercel はプランの上限まで、Cloudflare Workers ではこの値は使われない。
 */
export const maxDuration = 300;

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
      {/* どの画面からでも開く。器の外に浮かせるので ShellBox の外に置く */}
      <Find />
      <Note />
    </Shell>
  );
}
