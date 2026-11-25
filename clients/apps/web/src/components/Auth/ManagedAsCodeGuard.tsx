import AccessRestrictedView from '@/components/Auth/AccessRestrictedView'
import { MANAGED_AS_CODE_MESSAGE } from '@/utils/permissions'
import { getOrganizationBySlug } from '@/utils/organization'

// Server component: blocks catalog edit routes for organizations that manage
// their catalog through `polar config draft`.
export default async function ManagedAsCodeGuard({
  organizationSlug,
  children,
  standalone = false,
}: {
  organizationSlug: string
  children: React.ReactNode
  standalone?: boolean
}) {
  const organization = await getOrganizationBySlug(organizationSlug)

  if (organization?.feature_settings?.config_as_code_enabled) {
    return (
      <AccessRestrictedView
        message={MANAGED_AS_CODE_MESSAGE}
        standalone={standalone}
      />
    )
  }

  return children
}
