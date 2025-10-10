import { schemas } from '@polar-sh/client'
import { RequestCookiesAdapter } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerSideAPI } from './utils/client'

const POLAR_AUTH_COOKIE_KEY =
  process.env.POLAR_AUTH_COOKIE_KEY || 'polar_session'

const AUTHENTICATED_ROUTES = [
  new RegExp('^/start(/.*)?'),
  new RegExp('^/dashboard(/.*)?'),
  new RegExp('^/finance(/.*)?'),
  new RegExp('^/settings(/.*)?'),
]

const isForwardedRoute = (request: NextRequest): boolean => {
  if (request.nextUrl.pathname.startsWith('/docs/')) {
    return true
  }

  if (request.nextUrl.pathname.startsWith('/mintlify-assets/')) {
    return true
  }

  if (request.nextUrl.pathname.startsWith('/_mintlify/')) {
    return true
  }

  if (request.nextUrl.pathname.startsWith('/ingest/')) {
    return true
  }

  return false
}

const requiresAuthentication = (request: NextRequest): boolean => {
  if (isForwardedRoute(request)) {
    return false
  }

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
  // Do not run middleware for forwarded routes
  // @pieterbeulque added this because the `config.matcher` behavior below
  // doesn't appear to be working consistently with Vercel rewrites
  if (isForwardedRoute(request)) {
    return NextResponse.next()
  }

  let user: schemas['UserRead'] | undefined = undefined

  if (request.cookies.has(POLAR_AUTH_COOKIE_KEY)) {
    const api = await createServerSideAPI(
      request.headers,
      RequestCookiesAdapter.seal(request.cookies),
    )
    const { data, response } = await api.GET('/v1/users/me', {
      cache: 'no-cache',
    })
    if (!response.ok && response.status !== 401) {
      console.error(
        `Error response: status=${response.status}, headers=${JSON.stringify(Object.fromEntries(response.headers.entries()))}`,
      )
      throw new Error(
        'Unexpected response status while fetching authenticated user',
      )
    }
    user = data
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
     * - ingest (Posthog)
     * - monitoring (Sentry)
     * - docs, _mintlify, mintlify-assets (Mintlify)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|ingest|monitoring|docs|_mintlify|mintlify-assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
