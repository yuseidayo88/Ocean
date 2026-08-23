'use client';

import { createContext, useContext } from 'react';

/**
 * 盤面（オフィス / ワークフロー）が**いまどれだけ縮んでいるか**。
 *
 * 2つの掛け算になっている:
 *   ・**入る大きさに縮めるぶん**（右に会話を開くと横幅が足りなくなる）
 *   ・**自分で拡大縮小したぶん**（ツールバーの ＋ / − / 収める）
 *
 * ツールバーの数字は掛けたあとの値を言う — **数字と絵を食い違わせない**。
 */
export type Board = { k: number; zoom: (d: number) => void; fit: () => void; own: number };

export const Zoom = createContext<Board>({ k: 1, zoom: () => {}, fit: () => {}, own: 1 });
export const useZoom = () => useContext(Zoom);

/** 拡大縮小の刻み。0.5〜2 倍まで */
export const STEP = 0.1, MIN_K = 0.5, MAX_K = 2;
