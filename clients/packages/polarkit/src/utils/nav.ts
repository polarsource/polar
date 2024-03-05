import { Organization } from '@polar-sh/sdk'
import { CONFIG } from '../..'

export const organizationPageLink = (
  org: Organization,
  path?: string,
): string => {
  if (org.custom_domain) {
    return `https://${org.custom_domain}/${path ?? ''}`
  }

  return `${CONFIG.FRONTEND_BASE_URL}/${org.name}/${path ?? ''}`
}
