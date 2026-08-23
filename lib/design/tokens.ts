/**
 * デザイントークン — design/canvas/DesignSystem.dc.html の確定値。
 * 画面のCSSは globals.css の変数を使う。ここは TS から参照したいとき用。
 */
export const color = {
  ground: '#000000',   // 背景は純黒
  rail:   '#141414',   // 明るい面は左レールだけ
  card:   '#0E0E0E',
  line:   '#232323',   // 境界
  hair:   '#161616',   // 並ぶものを区切るヘアライン

  blue:   '#1A73E8',   // 次に押すもの（1ペインに1つ）
  green:  '#1E8E3E',   // 済んだ・推奨
  amber:  '#E37400',   // 判断待ち・要確認
  red:    '#D93025',   // やめる・超過

  blueText:  '#669DF6',
  greenText: '#5BB974',
  amberText: '#FDD663',
  redText:   '#F28B82',

  t1: '#EDEDED', t2: '#B8B8B8', t3: '#8B8B8B', t4: '#6E6E6E', t5: '#5F5F5F',
} as const

/** AI社員の色。オフィスと進捗の可視化だけに使う（表・リスト・ピルには出さない） */
export const agentColor = {
  cyan: '#2AA9BF', purple: '#9A5CD0', indigo: '#5C6BC0', green: '#34A853',
} as const


/* ══════════════ 画面が使う短い名前 ══════════════
 * **色はここにしかない。** 画面ごとに `const T1 = '#EDEDED'` と書き写さない
 * （22ファイルが同じ値を持っていて、1色変えるのに25ファイル触る状態だった）。
 *
 * 意味は CLAUDE.md「色は意味だけに使う」のとおり —
 *   青＝次に押すもの（1ペインに1つ）／ 緑＝済・推奨 ／ 橙＝判断待ち・要確認 ／ 赤＝停止・遅れ
 * **面は濃く、文字は明るく。** `_T` が付くほうが文字用。
 */
export const T1 = color.t1, T2 = color.t2, T3 = color.t3, T4 = color.t4, T5 = color.t5
export const BLUE = color.blue, GREEN = color.green, AMBER = color.amber, RED = color.red
export const BLUE_T = color.blueText, GREEN_T = color.greenText
export const AMBER_T = color.amberText, RED_T = color.redText

/** 統括AI。AI社員ではないので `agentColor` に入れない */
export const EXEC = '#D2D2D2'

/**
 * 面のはしご。**暗いほうから明るいほうへ。**
 * 背景 → 盤面 → カード → レール → ヘアライン → 罫 → 枠 → 押せる面 → 沈んだ文字。
 * 新しい灰色を作る前に、ここに合うものが無いか見る
 * （前は #1B1B1B / #262626 / #2C2C2C のような一度きりの灰色が15色ほど流れていた）。
 */
export const GROUND = color.ground     // #000000 背景
export const CANVAS = '#060606'        // 盤面（ワークフローのドット地）
export const CARD = color.card         // #0E0E0E カード
export const RAIL = color.rail         // #141414 左レール・明るい面
export const HAIR = color.hair         // #161616 並ぶものを区切る線
export const LINE = color.line         // #232323 境界
export const DIM = '#3A3A3A'           // 沈めたもの・点線の枠

/**
 * 暗いほうの目盛り。**この6つの外に新しい灰色を作らない。**
 * 前は #1B1B1B / #242424 / #2C2C2C のような一度きりの灰色が15色ほど流れていて、
 * どれが同じ役目なのか読めなかった。
 *
 * **値を寄せてはいない**（見た目を勝手に変えないため）。役目に名前を付けただけなので、
 * 近い2つを1つにするかどうかは、いつでも決められる。
 */
export const SUNK = '#1A1A1A'          // 沈んだ面（バーの溝・浮き板の地・選択肢の面）
export const WELL = '#1F1F1F'          // 選んでいる面・空の目盛り
export const SEAM = '#1C1C1C'          // 暗い面の上の継ぎ目
export const RULE = '#262626'          // レールの中の区切り・点線の枠
export const EDGE = '#2A2A2A'          // 押せるものの枠（ボタン・入力・トグルのオフ）
export const FAINT = '#2E2E2E'         // その上に載る枠・かすかな印
export const MUTE = '#4A4A4A'          // いちばん沈んだ文字・小さい印（T5 より下）

export const radius = { row: 8, card: 12, input: 14, composer: 18, round: 999 } as const

/**
 * 浮いた入力欄のぶん、中身が空けておく高さ。
 * 内訳: 入力欄そのもの 52 ＋ 窓の下との間 24 ＋ **中身との間 32**。
 * 前は 112 で、入力欄が 94 あったので、中身の終わりと入力欄の上端がちょうど重なって詰まって見えていた。
 * （入力欄を1行にまとめて 52 になったぶん、空ける高さも詰めている）
 */
export const COMPOSER_H = 108

/** 左レールの幅 */
export const RAIL_W = 260
/** オフィスとワークフローの盤面。絵なので縮まない */
export const BOARD_W = 1148

/** 盤面のまわりの余白（左右16ずつ） */
export const BOARD_PAD = 32

/**
 * 器の最小幅。**これより狭いと窓のほうが横スクロールする**（中身は縮めない）。
 * これを置かないと、右ペインを開いたときに表のタイトル列が 0px まで潰れて中身が消える。
 * 盤面の余白ぶんも入れておく — ここで盤面がちょうど 100% で収まる。
 */
export const SHELL_MIN = RAIL_W + BOARD_W + BOARD_PAD

/**
 * 動きの長さと曲がり方。**全画面で同じものを使う。増やさない。**
 *
 * 速く始まってゆっくり止まる。ただし**始まりを強くしすぎない** —
 * 出だしで一気に進む曲線だと、最初の1フレームで半分まで飛んでしまい、
 * 「滑った」ではなく「跳んだ」に見える。
 * `cubic-bezier(.33,1,.68,1)` は最初の1フレームで 1/4 ほど進み、あとは緩んで止まる。
 */
export const EASE = '.32s cubic-bezier(.33, 1, .68, 1)'
/** 小さいもの（面の明るさ・文字の色）はもっと短く */
export const EASE_FAST = '.16s cubic-bezier(.33, 1, .68, 1)'
