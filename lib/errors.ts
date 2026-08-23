/**
 * 失敗の扱い。**偽の進捗を出さない** — 止まったら止まったと出す。
 */
export type FailureKind =
  | 'unauthorized'   // ログインが要る
  | 'not_found'
  | 'rate_limited'   // 枠に当たって止まった（トークンを画面に出すのはここだけ）
  | 'upstream'       // モデル側の失敗
  | 'unknown'

export class AppError extends Error {
  constructor(
    readonly kind: FailureKind,
    message: string,
    readonly cause?: unknown,
    /** 社長に見せる1行。無ければ kind から決める */
    readonly userMessage?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const HTTP_STATUS: Record<FailureKind, number> = {
  unauthorized: 401, not_found: 404, rate_limited: 429, upstream: 502, unknown: 500,
}

/** 社長に見せる1行。**中身は出さない**（Postgres のエラー文をそのまま出さない） */
const SAY: Record<FailureKind, string> = {
  unauthorized: 'ログインが要ります',
  not_found: '見つかりませんでした',
  rate_limited: '枠に当たって止まりました',
  upstream: '統括AIが応えませんでした',
  unknown: 'うまくいきませんでした',
}

/**
 * 画面に出す1行を作る。**例外の中身は画面に出さない。**
 * 前は server action が `e.message` をそのまま返していたので、
 * Postgres のエラー文（表の名前・制約の名前）が社長の画面に出ていた。
 * 中身はサーバーのログに残す。
 */
export function sayError(e: unknown, fallback?: string): string {
  const err = toAppError(e)
  console.error('[onefound]', err.kind, err.message)
  return err.userMessage ?? fallback ?? SAY[err.kind]
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  const status = (e as { status?: number } | undefined)?.status
  if (status === 401 || status === 403) return new AppError('unauthorized', String(e), e)
  if (status === 404) return new AppError('not_found', String(e), e)
  if (status === 429) return new AppError('rate_limited', String(e), e)
  if (typeof status === 'number' && status >= 500) return new AppError('upstream', String(e), e)
  return new AppError('unknown', e instanceof Error ? e.message : String(e), e)
}

/** API ルートから返す形。中身は漏らさない */
export function errorResponse(e: unknown): Response {
  const err = toAppError(e)
  return Response.json({ error: { kind: err.kind } }, { status: HTTP_STATUS[err.kind] })
}
