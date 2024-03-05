import { Organization } from '@polar-sh/sdk'
import { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { organizationPageLink } from 'polarkit/utils/nav'

export const redirectToCustomDomain = (
  org: Organization,
  headers: ReadonlyHeaders,
  path?: string,
) => {
  if (!org.custom_domain) {
    return
  }

  const requestHost = headers.get('host')
  if (!requestHost) {
    return
  }

  if (requestHost !== org.custom_domain) {
    redirect(organizationPageLink(org, path))
  }
}

export const requestHost = (
  request: NextRequest,
): { protocol: string; host: string; hostname: string } => {
  // Get hostname from request or x-forwarded-host header(s)
  let hostname = request.nextUrl.hostname
  let host = request.nextUrl.host.replaceAll(':', '')
  let protocol = request.nextUrl.protocol

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const forwardedHost = request.headers.get('x-forwarded-host')
    if (forwardedHost) {
      hostname = forwardedHost.split(':')[0]
      host = forwardedHost
    }

    const forwardedProto = request.headers.get('x-forwarded-proto')
    if (forwardedProto) {
      protocol = forwardedProto.replaceAll(':', '')
    }
  }

  return { protocol, hostname, host }
}
