import 'server-only'
import { getCurrentUserSafe } from '@/lib/auth/current-user'

// =============================================================================
// Guardrails for the in-app agent endpoints (/api/agent/*).
// -----------------------------------------------------------------------------
// The agent is read-only by construction: no tool exists that can write. These
// guards cover the two things "read-only" does not cover, which are an open
// endpoint spending the org's Anthropic key, and an oversized conversation
// being used to smuggle instructions past the system prompt.
//
// Rules here must stay in sync with docs/agent-guardrails.md.
// =============================================================================

export const AGENT_LIMITS = {
  maxMessages: 20,
  maxCharsPerMessage: 4_000,
  maxTotalChars: 24_000,
  rateLimitRequests: 20,
  rateLimitWindowMs: 5 * 60 * 1000,
} as const

export type GuardFailure = {
  status: number
  body: { error: string; message: string }
}

// --- Authentication ----------------------------------------------------------
// proxy.ts only protects page prefixes, so /api/agent/* is not covered by the
// middleware. Without this check the endpoint is open to the internet and any
// caller can spend ANTHROPIC_API_KEY.

export async function requireAgentAccess(): Promise<GuardFailure | null> {
  // Fails closed: getCurrentUserSafe returns null when the check cannot run,
  // and an auth check that cannot run is not a passed auth check. The local
  // development bypass is handled inside it, not here.
  const user = await getCurrentUserSafe()

  if (!user) {
    return {
      status: 401,
      body: { error: 'unauthorized', message: 'Sign in to use the assistant.' },
    }
  }

  return null
}

// --- Rate limiting -----------------------------------------------------------
// In-memory sliding window. Per server instance, so it is a cost brake rather
// than a security boundary. Replace with a shared store before public exposure.

const hits = new Map<string, number[]>()

export function rateLimitKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  return fwd.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

export function checkRateLimit(key: string): GuardFailure | null {
  const now = Date.now()
  const window = AGENT_LIMITS.rateLimitWindowMs
  const recent = (hits.get(key) ?? []).filter((t) => now - t < window)

  if (recent.length >= AGENT_LIMITS.rateLimitRequests) {
    hits.set(key, recent)
    return {
      status: 429,
      body: {
        error: 'rate_limited',
        message: `Too many assistant requests. Limit is ${AGENT_LIMITS.rateLimitRequests} every ${window / 60_000} minutes.`,
      },
    }
  }

  recent.push(now)
  hits.set(key, recent)

  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= window)) hits.delete(k)
    }
  }
  return null
}

// --- Input shape -------------------------------------------------------------

export type IncomingMessage = { role: 'user' | 'assistant'; content: string }

export function validateMessages(
  raw: unknown
): { ok: true; messages: IncomingMessage[] } | { ok: false; failure: GuardFailure } {
  const bad = (message: string): { ok: false; failure: GuardFailure } => ({
    ok: false,
    failure: { status: 400, body: { error: 'bad_request', message } },
  })

  if (!Array.isArray(raw)) return bad('messages array is required.')

  const messages = raw.filter(
    (m): m is IncomingMessage =>
      !!m &&
      typeof m === 'object' &&
      ((m as IncomingMessage).role === 'user' || (m as IncomingMessage).role === 'assistant') &&
      typeof (m as IncomingMessage).content === 'string'
  )

  if (messages.length === 0) return bad('messages array is required.')
  if (messages.length > AGENT_LIMITS.maxMessages) {
    return bad(`Conversation too long. Limit is ${AGENT_LIMITS.maxMessages} messages.`)
  }

  let total = 0
  for (const m of messages) {
    if (m.content.length > AGENT_LIMITS.maxCharsPerMessage) {
      return bad(`Message too long. Limit is ${AGENT_LIMITS.maxCharsPerMessage} characters.`)
    }
    total += m.content.length
  }
  if (total > AGENT_LIMITS.maxTotalChars) {
    return bad(`Conversation too large. Limit is ${AGENT_LIMITS.maxTotalChars} characters.`)
  }

  return { ok: true, messages }
}
