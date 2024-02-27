import { Organization } from '@polar-sh/sdk'
import { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers'
import { redirect } from 'next/navigation'
import { CONFIG } from 'polarkit/config'

export const organizationPageLink = (
  org: Organization,
  path?: string,
): string => {
  if (org.custom_domain) {
    if (process.env.NODE_ENV === 'production') {
      return `https://${org.custom_domain}/${path ?? ''}`
    }
    return `http://${org.custom_domain}/${path ?? ''}`
  }

  return `${CONFIG.FRONTEND_BASE_URL}/${org.name}/${path ?? ''}`
}

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
