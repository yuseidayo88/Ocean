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

export const radius = { row: 8, card: 12, input: 14, composer: 18, round: 999 } as const

/** 浮いた入力欄の高さ。下に貼り付く中身はこのぶん逃がす */
export const COMPOSER_H = 112

/** 左レールの幅 */
export const RAIL_W = 260
/** オフィスとワークフローの盤面。絵なので縮まない */
export const BOARD_W = 1148

/**
 * 器の最小幅。**これより狭いと窓のほうが横スクロールする**（中身は縮めない）。
 * これを置かないと、右ペインを開いたときに表のタイトル列が 0px まで潰れて中身が消える。
 */
export const SHELL_MIN = RAIL_W + BOARD_W

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
