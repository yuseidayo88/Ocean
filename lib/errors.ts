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
