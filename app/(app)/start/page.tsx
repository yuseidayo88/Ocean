import Link from 'next/link';
import { Composer, TopBar } from '@/components/shell/Chrome';
import { Icon } from '@/components/ui/Icon';
import { Orb } from '@/components/ui/Orb';

/**
 * ⓪ はじめての画面。入口は3つに分かれる。
 * 入力欄が主役なので中央に置く（floating=false）。**偽の中身を置かない。**
 */

const T2 = '#B8B8B8', T4 = '#6E6E6E', T5 = '#5F5F5F';

const CHOICES = [
  { href: '/discovery', icon: 'search', title: 'まだ決まっていない', sub: '条件から一緒に決めます' },
  { href: '/import',    icon: 'globe',  title: 'すでに事業がある',   sub: '取り込んで、診断します' },
] as const;

export default function StartPage() {
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
      <TopBar title="はじめまして" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, padding: 24 }}>
        <Orb color="#D2D2D2" size={104} seed={7} />
        <span style={{ fontSize: 26, lineHeight: '36px' }}>何をはじめますか？</span>
        <Composer placeholder="やりたいことを、そのまま書いてください" floating={false} />
        <div style={{ display: 'flex', gap: 14, width: '100%', maxWidth: 748 }}>
          {CHOICES.map((c) => (
            <Link key={c.href} href={c.href} style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px',
              borderRadius: 12, background: '#0B0B0B', border: '1px solid #1C1C1C',
            }}>
              <Icon name={c.icon} color={T4} size={16} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ color: T2 }}>{c.title}</span>
                <span style={{ color: T5, fontSize: 11.5 }}>{c.sub}</span>
              </div>
              <div style={{ flex: 1 }} />
              <Icon name="chev" color="#3A3A3A" size={13} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
