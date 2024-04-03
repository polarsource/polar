import { ResponseError } from '@polar-sh/sdk'
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
  if (url.pathname.startsWith('/favicon.ico')) {
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

  const noRewrirePrefixes = ['/subscribe/success']

  // No redirect prefixes
  for (const prefix of noRewrirePrefixes) {
    if (url.pathname.startsWith(prefix)) {
      return
    }
  }

  const api = getServerSideAPI()
  try {
    const org = await api.organizations.lookup({
      customDomain: hostname,
    })
    return NextResponse.rewrite(
      new URL(`/${org.name}${url.pathname}`, request.url),
    )
  } catch (e) {
    if (e instanceof ResponseError) {
      console.error(
        `middleware.ts: error while fetching custom domain organization: ${e.response.status}`,
      )
    } else {
      console.error(e)
    }
  }
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
