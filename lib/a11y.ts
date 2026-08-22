import type { KeyboardEvent } from 'react';

/**
 * 押せる div を、キーボードでも押せるようにする。
 * 行そのものが押せる表・一覧は <button> にできない（中に <Link> が入る）ので、
 * role と tabIndex と Enter / Space をここで揃える。
 */
export const pressable = (fn: () => void) => ({
  role: 'button' as const,
  tabIndex: 0,
  onClick: fn,
  onKeyDown: (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  },
});
