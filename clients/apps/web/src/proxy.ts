import { schemas } from '@polar-sh/client'
import { nanoid } from 'nanoid'
import { RequestCookiesAdapter } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerSideAPI } from './utils/client'

const POLAR_AUTH_COOKIE_KEY =
  process.env.POLAR_AUTH_COOKIE_KEY || 'polar_session'

const DISTINCT_ID_COOKIE = 'polar_distinct_id'
const DISTINCT_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const AUTHENTICATED_ROUTES = [
  new RegExp('^/start(/.*)?'),
  new RegExp('^/dashboard(/.*)?'),
  new RegExp('^/finance(/.*)?'),
  new RegExp('^/settings(/.*)?'),
  new RegExp('^/oauth2(/.*)?'),
]

const setDistinctIdCookie = (
  request: NextRequest,
  response: NextResponse,
): void => {
  if (!request.cookies.get(DISTINCT_ID_COOKIE)) {
    response.cookies.set(DISTINCT_ID_COOKIE, `anon_${nanoid()}`, {
      maxAge: DISTINCT_ID_COOKIE_MAX_AGE,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })
  }
}

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

export async function proxy(request: NextRequest) {
  // Do not run middleware for forwarded routes
  // @pieterbeulque added this because the `config.matcher` behavior below
  // doesn't appear to be working consistently with Vercel rewrites
  if (isForwardedRoute(request)) {
    return NextResponse.next()
  }

  // Redirect old customer query string URLs to path-based URLs
  const customersMatch = request.nextUrl.pathname.match(
    /^\/dashboard\/([^/]+)\/customers$/,
  )
  if (customersMatch && request.nextUrl.searchParams.has('customerId')) {
    const customerId = request.nextUrl.searchParams.get('customerId')
    const redirectURL = request.nextUrl.clone()
    redirectURL.pathname = `/dashboard/${customersMatch[1]}/customers/${customerId}`
    redirectURL.searchParams.delete('customerId')
    return NextResponse.redirect(redirectURL)
  }

  // Redirect old benefit query string URLs to path-based URLs
  const benefitsMatch = request.nextUrl.pathname.match(
    /^\/dashboard\/([^/]+)\/benefits$/,
  )
  if (benefitsMatch && request.nextUrl.searchParams.has('benefitId')) {
    const benefitId = request.nextUrl.searchParams.get('benefitId')
    const redirectURL = request.nextUrl.clone()
    redirectURL.pathname = `/dashboard/${benefitsMatch[1]}/products/benefits/${benefitId}`
    redirectURL.searchParams.delete('benefitId')
    return NextResponse.redirect(redirectURL)
  }

  // Redirect old checkout link query string URLs to path-based URLs
  const checkoutLinksMatch = request.nextUrl.pathname.match(
    /^\/dashboard\/([^/]+)\/products\/checkout-links$/,
  )
  if (
    checkoutLinksMatch &&
    request.nextUrl.searchParams.has('checkoutLinkId')
  ) {
    const checkoutLinkId = request.nextUrl.searchParams.get('checkoutLinkId')
    const redirectURL = request.nextUrl.clone()
    redirectURL.pathname = `/dashboard/${checkoutLinksMatch[1]}/products/checkout-links/${checkoutLinkId}`
    redirectURL.searchParams.delete('checkoutLinkId')
    return NextResponse.redirect(redirectURL)
  }

  // Redirect old meter query string URLs to path-based URLs
  const metersMatch = request.nextUrl.pathname.match(
    /^\/dashboard\/([^/]+)\/usage-billing\/meters$/,
  )
  if (metersMatch && request.nextUrl.searchParams.has('selectedMeter')) {
    const selectedMeter = request.nextUrl.searchParams.get('selectedMeter')
    const redirectURL = request.nextUrl.clone()
    redirectURL.pathname = `/dashboard/${metersMatch[1]}/products/meters/${selectedMeter}`
    redirectURL.searchParams.delete('selectedMeter')
    return NextResponse.redirect(redirectURL)
  }

  // Redirect deprecated path-based URLs to new structure
  // Events: /dashboard/{org}/usage-billing/events/* -> /dashboard/{org}/analytics/events/*
  const eventsPathMatch = request.nextUrl.pathname.match(
    /^\/dashboard\/([^/]+)\/usage-billing\/events(\/.*)?$/,
  )
  if (eventsPathMatch) {
    const redirectURL = request.nextUrl.clone()
    redirectURL.pathname = `/dashboard/${eventsPathMatch[1]}/analytics/events${eventsPathMatch[2] || ''}`
    return NextResponse.redirect(redirectURL, { status: 308 })
  }

  // Benefits: /dashboard/{org}/benefits/* -> /dashboard/{org}/products/benefits/*
  const benefitsPathMatch = request.nextUrl.pathname.match(
    /^\/dashboard\/([^/]+)\/benefits(\/.*)?$/,
  )
  if (benefitsPathMatch) {
    const redirectURL = request.nextUrl.clone()
    redirectURL.pathname = `/dashboard/${benefitsPathMatch[1]}/products/benefits${benefitsPathMatch[2] || ''}`
    return NextResponse.redirect(redirectURL, { status: 308 })
  }

  // Meters: /dashboard/{org}/usage-billing/meters/* -> /dashboard/{org}/products/meters/*
  const metersPathMatch = request.nextUrl.pathname.match(
    /^\/dashboard\/([^/]+)\/usage-billing\/meters(\/.*)?$/,
  )
  if (metersPathMatch) {
    const redirectURL = request.nextUrl.clone()
    redirectURL.pathname = `/dashboard/${metersPathMatch[1]}/products/meters${metersPathMatch[2] || ''}`
    return NextResponse.redirect(redirectURL, { status: 308 })
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
  const response = NextResponse.next({ headers })

  setDistinctIdCookie(request, response)

  return response
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
