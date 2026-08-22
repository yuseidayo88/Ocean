'use client';

import { createContext, useContext } from 'react';

/**
 * 盤面（オフィス / ワークフロー）が**いまどれだけ縮んでいるか**。
 * 右に会話を開くと横幅が足りなくなるので、絵のほうを入る大きさに縮める。
 * ツールバーの数字はこれを読む — **数字と絵を食い違わせない**。
 */
export const Zoom = createContext(1);
export const useZoom = () => useContext(Zoom);
