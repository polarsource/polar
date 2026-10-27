'use client'

import AccessRestricted from '@/components/Finance/AccessRestricted'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import OrganizationDeleteSettings from '@/components/Settings/OrganizationDeleteSettings'
import OrganizationProfileSettings from '@/components/Settings/OrganizationProfileSettings'
import { LEGACY_SETTINGS_HASHES } from '@/components/Settings/settingsSections'
import { useHasPermission } from '@/hooks/permissions'
import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const canManageOrganization = useHasPermission(org.id, 'organization:manage')

  useEffect(() => {
    const section = LEGACY_SETTINGS_HASHES[window.location.hash.slice(1)]
    if (section) {
      router.replace(`/dashboard/${org.slug}/settings/${section}`)
    }
  }, [router, org.slug])

  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-md)!" title="General">
      <Box flexDirection="column" rowGap="2xl">
        <OrganizationProfileSettings
          organization={org}
          readOnly={!canManageOrganization}
        />
        {canManageOrganization ? (
          <OrganizationDeleteSettings organization={org} />
        ) : (
          <AccessRestricted message="You don't have permission to delete this organization." />
        )}
      </Box>
    </DashboardBody>
  )
}
