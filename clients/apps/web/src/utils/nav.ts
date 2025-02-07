import { CONFIG } from '@/utils/config'
import { components } from '@polar-sh/client'
import type { Organization as OrganizationSDK } from '@polar-sh/sdk/models/components/organization'

export const organizationPageLink = (
  org: components['schemas']['Organization'] | OrganizationSDK,
  path?: string,
): string => {
  return `${CONFIG.FRONTEND_BASE_URL}/${org.slug}/${path ?? ''}`
}
