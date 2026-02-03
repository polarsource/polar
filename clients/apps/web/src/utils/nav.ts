import { CONFIG } from '@/utils/config'
import { schemas } from '@spaire/client'
import type { Organization as OrganizationSDK } from '@polar-sh/sdk/models/components/organization'

export const organizationPageLink = (
  org:
    | schemas['Organization']
    | schemas['CustomerOrganization']
    | OrganizationSDK,
  path?: string,
): string => {
  return `${CONFIG.FRONTEND_BASE_URL}/${org.slug}/${path ?? ''}`
}
