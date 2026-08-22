/**
 * 画面が入れ替わるときの動き。
 * `template` は行き先が変わるたびに作り直されるので、CSS のアニメーションが毎回走る。
 * **中央と右だけ動かす。左レールは動かさない**（行き先の一覧が毎回ちらつくと落ち着かない）。
 * 動きは控えめに — 下から 6px、160ms。**待たされる感じにしない。**
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page">{children}</div>;
}
