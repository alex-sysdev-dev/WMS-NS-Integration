import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'

import { auth, isEntraConfigured } from '@/lib/auth/config'
import { isLocalDevAccessEnabled } from '@/lib/dev-access'

/**
 * Route protection at the edge.
 *
 * This is a first gate, not the only one. The app layout checks identity again
 * server side, because middleware only guards page prefixes and says nothing
 * about API routes. /api/agent/* in particular is guarded by lib/agent-guard.ts
 * rather than here.
 *
 * The prefix list is the operational app. It deliberately omits /fab-station,
 * which does not exist yet: the station is a shared-laptop surface authorized
 * by badge scan per action rather than by session, so it will need its own rule
 * rather than this one.
 */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/fab-team',
  '/fabrication',
  '/inbound',
  '/outbound',
  '/qc',
]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function redirectTo(request: NextRequest, pathname: string, keepNext: boolean): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''

  if (keepNext) {
    url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
  }

  return NextResponse.redirect(url)
}

/**
 * `auth()` is overloaded across middleware and route-handler shapes, and
 * TypeScript resolves it to the route-handler one, whose second parameter is a
 * context object rather than a fetch event. This is the middleware shape, which
 * is how Next actually calls it.
 */
type MiddlewareHandler = (
  request: NextRequest,
  event: NextFetchEvent
) => Promise<NextResponse | undefined> | NextResponse | undefined

/** The signed-in path. Only reached once Entra is actually configured. */
const withSession = auth((request) => {
  const { pathname } = request.nextUrl
  const signedIn = Boolean(request.auth)

  if (isProtectedPath(pathname) && !signedIn) {
    return redirectTo(request, '/login', true)
  }

  if (pathname === '/login' && signedIn) {
    return redirectTo(request, '/dashboard', false)
  }

  return NextResponse.next()
})

/**
 * Auth.js is only invoked when it can actually do something.
 *
 * Its config assertion runs before any callback body, so wrapping every request
 * in `auth()` made it demand AUTH_SECRET on requests that were never going to
 * consult a session: the local dev bypass, and the current state where no app
 * registration exists. That threw MissingSecret on every request while still
 * rendering the page, which is the worst combination, a log full of real-looking
 * errors that nothing is actually wrong with.
 *
 * So the two short-circuits happen out here, before the wrapper.
 */
export function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl

  if (isLocalDevAccessEnabled()) {
    return pathname === '/login'
      ? redirectTo(request, '/dashboard', false)
      : NextResponse.next()
  }

  // No provider and no secret means nobody can be signed in. Guard the app
  // rather than asking Auth.js a question it has no configuration to answer.
  if (!isEntraConfigured()) {
    return isProtectedPath(pathname) ? redirectTo(request, '/login', true) : NextResponse.next()
  }

  return (withSession as unknown as MiddlewareHandler)(request, event)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
