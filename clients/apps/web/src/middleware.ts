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

  if (url.pathname.startsWith('/og')) {
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

  const noRewrirePrefixes = ['/subscribe/success']

  // No redirect prefixes
  for (const prefix of noRewrirePrefixes) {
    if (url.pathname.startsWith(prefix)) {
      return
    }
  }

  return NextResponse.rewrite(
    new URL(`/${org.name}${url.pathname}`, request.url),
  )
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
