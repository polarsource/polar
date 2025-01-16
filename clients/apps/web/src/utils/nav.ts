import { CONFIG } from '@/utils/config'
import { Organization } from '@polar-sh/api'

export const organizationPageLink = (
  org: Organization,
  path?: string,
): string => {
  return `${CONFIG.FRONTEND_BASE_URL}/${org.slug}/${path ?? ''}`
}
