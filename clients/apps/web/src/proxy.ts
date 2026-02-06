import { nanoid } from 'nanoid'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const POLAR_AUTH_COOKIE_KEY =
  process.env.POLAR_AUTH_COOKIE_KEY || 'spaire_session'

const DISTINCT_ID_COOKIE = 'spaire_distinct_id'
const DISTINCT_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const AUTHENTICATED_ROUTES = [
  new RegExp('^/start(/.*)?'),
  new RegExp('^/dashboard(/.*)?'),
  new RegExp('^/finance(/.*)?'),
  new RegExp('^/settings(/.*)?'),
  new RegExp('^/oauth2(/.*)?'),
]

const getOrCreateDistinctId = (
  request: NextRequest,
): { id: string; isNew: boolean } => {
  const existing = request.cookies.get(DISTINCT_ID_COOKIE)?.value
  if (existing) {
    return { id: existing, isNew: false }
  }
  return { id: `anon_${nanoid()}`, isNew: true }
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

  let user: Record<string, unknown> | undefined = undefined

  // Resolve API URL at request time (not module load time) to ensure
  // runtime env vars are available in Edge Runtime
  const apiUrl =
    process.env.POLAR_API_URL || process.env.NEXT_PUBLIC_API_URL || ''

  const hasCookie = request.cookies.has(POLAR_AUTH_COOKIE_KEY)
  if (hasCookie && apiUrl) {
    // Build Cookie header from all incoming request cookies
    const cookieHeader = request.cookies
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ')

    const fetchHeaders: Record<string, string> = {
      Cookie: cookieHeader,
    }
    const xForwardedFor = request.headers.get('X-Forwarded-For')
    if (xForwardedFor) {
      fetchHeaders['X-Forwarded-For'] = xForwardedFor
    }

    try {
      // Use direct fetch instead of openapi-fetch client to avoid
      // credentials: 'include' which can interfere with custom Cookie
      // headers in Edge Runtime environments
      const authResponse = await fetch(`${apiUrl}/v1/users/me`, {
        method: 'GET',
        headers: fetchHeaders,
        cache: 'no-cache',
      })

      if (authResponse.ok) {
        user = await authResponse.json()
      } else if (authResponse.status === 401) {
        console.error(
          `[proxy] Auth cookie '${POLAR_AUTH_COOKIE_KEY}' present but /v1/users/me returned 401. apiUrl: ${apiUrl}`,
        )
      } else {
        console.error(
          `[proxy] Unexpected response from /v1/users/me: status=${authResponse.status}, apiUrl: ${apiUrl}`,
        )
      }
    } catch (error) {
      console.error(
        `[proxy] Failed to verify user session: ${error}. apiUrl: ${apiUrl}`,
      )
      // Don't throw - gracefully degrade to unauthenticated
    }
  }

  if (requiresAuthentication(request) && !user) {
    if (!apiUrl) {
      console.error(
        '[proxy] Auth redirect: POLAR_API_URL and NEXT_PUBLIC_API_URL are both unset - cannot verify sessions',
      )
    } else if (!hasCookie) {
      console.error(
        `[proxy] Auth redirect: cookie '${POLAR_AUTH_COOKIE_KEY}' not found. Available cookies: ${request.cookies.getAll().map((c) => c.name).join(', ') || 'none'}`,
      )
    }
    return getLoginResponse(request)
  }

  const { id: distinctId, isNew: isNewDistinctId } =
    getOrCreateDistinctId(request)

  const headers: Record<string, string> = {
    'x-spaire-distinct-id': distinctId,
  }
  if (user) {
    headers['x-polar-user'] = JSON.stringify(user)
  }

  const response = NextResponse.next({ headers })

  if (isNewDistinctId) {
    response.cookies.set(DISTINCT_ID_COOKIE, distinctId, {
      maxAge: DISTINCT_ID_COOKIE_MAX_AGE,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })
  }

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
