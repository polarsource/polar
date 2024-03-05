import { NextRequest, NextResponse } from 'next/server'
import { getServerSideAPI } from './utils/api'
import { defaultApiUrl, defaultFrontendHostname } from './utils/domain'
import { requestHost } from './utils/nav'

// Custom domain name handlings
export async function middleware(request: NextRequest) {
  let url = new URL(request.url)

  // Unaffected by middleware
  if (url.pathname.startsWith('/_next/')) {
    return
  }

  // Proxy API requests to the Python API
  // Used on custom domains
  if (url.pathname.startsWith('/api/v1/')) {
    return customDomainApiProxy(request)
  }

  if (url.pathname.startsWith('/api/')) {
    return
  }

  // Trailing slash handling (we've disabled the default NextJS trailing slash handler)
  // This handling needs to happen _after_ the proxy handler above.
  if (request.nextUrl.pathname !== '/' && request.url.endsWith('/')) {
    return webPagesTrailingSlashRedirect(request)
  }

  const { hostname } = requestHost(request)

  // Skip dynamic lookup for polar.sh
  if (hostname === defaultFrontendHostname) {
    return
  }

  const api = getServerSideAPI()
  const org = await api.organizations.lookup({
    customDomain: hostname,
  })
  if (!org) {
    return
  }

  const orgname = org.name

  const strictMatches = ['/', '/subscribe']

  const allowedPrefixes = [
    '/posts',
    '/subscriptions',
    '/issues',
    '/repositories',
  ]

  const noRedirectPrefixes = ['/subscribe/success']

  // No redirect prefixes
  for (const prefix of noRedirectPrefixes) {
    if (url.pathname.startsWith(prefix)) {
      return
    }
  }

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
  const to = new URL(
    url.pathname,
    process.env.NEXT_PUBLIC_FRONTEND_BASE_URL ?? 'https://polar.sh',
  )

  if (url.searchParams) {
    url.searchParams.forEach((val, key) => {
      to.searchParams.set(key, val)
    })
  }

  return NextResponse.redirect(to)
}

async function customDomainApiProxy(
  request: NextRequest,
): Promise<NextResponse> {
  const url = new URL(request.url, defaultApiUrl)
  const upstream = new URL(defaultApiUrl)
  url.protocol = upstream.protocol
  url.hostname = upstream.hostname
  url.port = upstream.port
  return NextResponse.rewrite(url)
}

function webPagesTrailingSlashRedirect(
  request: NextRequest,
): NextResponse | undefined {
  return NextResponse.redirect(request.url.substring(0, request.url.length - 1))
}
