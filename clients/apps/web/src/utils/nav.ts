import { CONFIG } from '@/utils/config'
import type { Organization } from '@polar-sh/api'
import type { Organization as OrganizationSDK } from '@polar-sh/sdk/models/components/organization'

export const organizationPageLink = (
  org: Organization | OrganizationSDK,
  path?: string,
): string => {
  return `${CONFIG.FRONTEND_BASE_URL}/${org.slug}/${path ?? ''}`
}
