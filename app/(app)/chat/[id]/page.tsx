import { ChatView, type FirstLoad } from '@/components/chat/ChatView';
import { store } from '@/lib/store';

/**
 * 会話の画面。**中身はサーバーで組んでから渡す。**
 *
 * 前はここも器の中で立ち上がってから `threadGet` を取りに行っていたので、
 * 画面を開く → 器が立つ → もう1往復 → やっと会話が出る、の順になっていた。
 * ネットワーク越しだと、その1往復ぶんずっと「…」のままになる。
 * いまは**画面と一緒に会話が届く**。
 */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === 'new') {
    return <ChatView id={id} first={{ gone: false, title: '', to: '', messages: [], waiting: false }} />;
  }

  let first: FirstLoad = { gone: true };
  try {
    const s = store();
    const t = await s.getThread(id);
    if (t) {
      // 宛先の名前は**同じ往復で**引く（ラベル1つのために、もう1回取りに行かない）
      let to = '';
      if (t.thread.workId) {
        const works = await s.listWorks().catch(() => []);
        to = works.find((w) => w.id === t.thread.workId)?.title ?? '';
      }
      const last = t.messages[t.messages.length - 1];
      first = {
        gone: false, title: t.thread.title, to, messages: t.messages,
        // 最後が社長の発言なら、返事がまだ来ていない（開いた側が取りに行く）
        waiting: last?.role === 'user',
      };
    }
  } catch { /* 見えなければ「見つかりません」を出す */ }

  return <ChatView id={id} first={first} />;
}
