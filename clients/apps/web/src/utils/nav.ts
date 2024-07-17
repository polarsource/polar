import { CONFIG } from '@/utils/config'
import { Organization } from '@polar-sh/sdk'

export const organizationPageLink = (
  org: Organization,
  path?: string,
): string => {
  return `${CONFIG.FRONTEND_BASE_URL}/${org.slug}/${path ?? ''}`
}
