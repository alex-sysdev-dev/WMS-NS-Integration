import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseAuthServerClient } from '@/lib/supabase-auth-server'
import { isLocalDevAccessEnabled } from '@/lib/dev-access'

const PROTECTED_PREFIXES = [
  '/associates',
  '/dashboard',
  '/forecasting',
  '/inbound',
  '/outbound',
  '/qa',
  '/suppliers',
  '/yms',
]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function redirectToLogin(request: NextRequest): NextResponse {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/login'
  redirectUrl.search = ''
  redirectUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)

  return NextResponse.redirect(redirectUrl)
}

function redirectToDashboard(request: NextRequest): NextResponse {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/dashboard'
  redirectUrl.search = ''

  return NextResponse.redirect(redirectUrl)
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const { pathname } = request.nextUrl

  if (isLocalDevAccessEnabled()) {
    if (pathname === '/login') {
      return redirectToDashboard(request)
    }

    if (isProtectedPath(pathname)) {
      return response
    }
  }

  const supabase = createSupabaseAuthServerClient(
    () => request.cookies.getAll(),
    (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value }) => {
        request.cookies.set(name, value)
      })

      response = NextResponse.next({ request })

      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Any authenticated user is a normal user of the platform.
  if (isProtectedPath(pathname) && !user) {
    return redirectToLogin(request)
  }

  if (pathname === '/login' && user) {
    return redirectToDashboard(request)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
