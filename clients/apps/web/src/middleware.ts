import { NextRequest, NextResponse } from 'next/server'

// Custom domain name handlings
export function middleware(request: NextRequest) {
  let url = new URL(request.url)

  // Unaffected by middleware
  if (url.pathname.startsWith('/_next/')) {
    return
  }
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Get hostname from request or x-forwarded-host header
  let hostname = url.hostname
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    hostname = forwardedHost.split(':')[0]
  }

  // Test custom domains
  // TODO: move this to a API lookup
  const mapping: Record<string, string> = {
    // 'dev.forfunc.com': 'zegl',
    // 'zegl.forfunc.com': 'zegl',
  }

  if (!mapping[hostname]) {
    return
  }

  const orgname = mapping[hostname]

  const strictMatches = ['/']

  const allowedPrefixes = [
    '/posts',
    '/subscriptions',
    '/issues',
    '/repositories',
  ]

  // Rewrite strict matches
  if (strictMatches.includes(url.pathname)) {
    return NextResponse.rewrite(
      new URL(`/${orgname}${url.pathname}`, request.url),
    )
  }

  // Rewrite prefix matches
  for (const prefix of allowedPrefixes) {
    if (url.pathname.startsWith(prefix)) {
      return NextResponse.rewrite(
        new URL(`/${orgname}${url.pathname}`, request.url),
      )
    }
  }

  // This page falls outside of the scope of this custom domain.
  // For example if trying to access /faq or /ORGNAME
  // Redirect to the polar.sh version
  return NextResponse.redirect(
    new URL(
      url.pathname,
      process.env.NEXT_PUBLIC_FRONTEND_BASE_URL ?? 'https://polar.sh',
    ),
  )
}
