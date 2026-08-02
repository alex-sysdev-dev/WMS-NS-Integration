/**
 * Centralized logging for data-layer failures.
 *
 * Two problems this solves:
 *
 *   1. Noise. Every query module logged its own failure, so a single unreachable
 *      database produced ten near-identical errors in the dev overlay. That
 *      buries real bugs. Connectivity failures now collapse to one warning.
 *
 *   2. Severity. A database being unreachable is a configuration problem, not a
 *      code defect, and the query functions already handle it by returning empty
 *      results. Logging it as an error implies something is broken in the app.
 */

const reported = new Set<string>()

const CONNECTIVITY_PATTERN =
  /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|getaddrinfo|socket hang up|network/i

function describe(error: unknown): string {
  if (!error) {
    return ''
  }
  if (typeof error === 'string') {
    return error
  }
  const parts: string[] = []
  const candidate = error as Record<string, unknown>
  for (const key of ['message', 'details', 'hint', 'code']) {
    const value = candidate[key]
    if (typeof value === 'string') {
      parts.push(value)
    }
  }
  if (parts.length === 0) {
    try {
      parts.push(JSON.stringify(error))
    } catch {
      parts.push(String(error))
    }
  }
  return parts.join(' | ')
}

/** True when the failure is "cannot reach the database" rather than a bad query. */
export function isConnectivityError(error: unknown): boolean {
  return CONNECTIVITY_PATTERN.test(describe(error))
}

/**
 * Logs a data-layer failure at most once per distinct cause.
 *
 * Callers should still return a safe empty value — this only reports.
 */
export function logQueryError(context: string, error: unknown): void {
  if (isConnectivityError(error)) {
    if (reported.has('connectivity')) {
      return
    }
    reported.add('connectivity')
    console.warn(
      '[data] Database unreachable — pages will render with empty data. ' +
        'Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.'
    )
    return
  }

  const key = `${context}|${describe(error)}`
  if (reported.has(key)) {
    return
  }
  reported.add(key)
  console.error(context, error)
}
