import { ResponseError, UserRead } from '@polar-sh/sdk'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { buildServerSideAPI } from './utils/api'

const POLAR_AUTH_COOKIE_KEY =
  process.env.POLAR_AUTH_COOKIE_KEY || 'polar_session'

const AUTHENTICATED_ROUTES = [
  new RegExp('/start(/.*)?'),
  new RegExp('/dashboard(/.*)?'),
  new RegExp('/funding(/.*)?'),
  new RegExp('/finance(/.*)?'),
  new RegExp('/purchases(/.*)?'),
  new RegExp('/settings(/.*)?'),
  new RegExp('/backoffice(/.*)?'),
]

const requiresAuthentication = (request: NextRequest): boolean => {
  return AUTHENTICATED_ROUTES.some((route) =>
    route.test(request.nextUrl.pathname),
  )
}

const getLoginResponse = (request: NextRequest): NextResponse => {
  const redirectURL = request.nextUrl.clone()
  redirectURL.pathname = '/login'
  redirectURL.search = ''
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`
  redirectURL.searchParams.set('return_to', returnTo)
  return NextResponse.redirect(redirectURL)
}

export async function middleware(request: NextRequest) {
  let user: UserRead | null = null
  if (request.cookies.has(POLAR_AUTH_COOKIE_KEY)) {
    const api = buildServerSideAPI(request.headers, request.cookies)
    try {
      user = await api.users.getAuthenticated({ cache: 'no-cache' })
    } catch (e) {
      if (e instanceof ResponseError === false || e.response.status !== 401) {
        throw e
      }
    }
  }

  if (requiresAuthentication(request) && !user) {
    return getLoginResponse(request)
  }

  const headers = user ? { 'x-polar-user': JSON.stringify(user) } : undefined
  return NextResponse.next({ headers })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
