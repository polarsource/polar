import { Organization } from '@polar-sh/sdk'
import { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { organizationPageLink } from 'polarkit/utils/nav'

export const redirectToCanonicalDomain = ({
  organization,
  paramOrganizationName,
  headers,
  subPath,
}: {
  organization: Organization
  paramOrganizationName: string
  headers: ReadonlyHeaders
  subPath?: string
}) => {
  // Redirect to custom domain.
  // Example: polar.sh/zegl -> zegl.se
  if (organization.custom_domain) {
    const requestHost = headers.get('host')
    if (!requestHost) {
      return
    }
    if (requestHost !== organization.custom_domain) {
      redirect(organizationPageLink(organization, subPath))
    }
  }

  // Redirect to canonical spelling of org name
  if (paramOrganizationName !== organization.name) {
    redirect(`/${organization.name}${subPath ?? ''}`)
  }
}

export const requestHost = (
  request: NextRequest,
): { protocol: string; host: string; hostname: string } => {
  // Get hostname from request or x-forwarded-host header(s)
  let hostname = request.nextUrl.hostname
  let host = request.nextUrl.host
  let protocol = request.nextUrl.protocol.replaceAll(':', '')

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
