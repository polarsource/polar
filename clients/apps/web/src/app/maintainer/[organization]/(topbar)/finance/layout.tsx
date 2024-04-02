'use client'

import { useDashboardRoutes } from '@/components/Dashboard/navigation'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { SubNav } from '@/components/Navigation/DashboardTopbar'
import {
  useCurrentOrgAndRepoFromURL,
  useIsOrganizationAdmin,
  usePersonalOrganization,
} from '@/hooks'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { org: currentOrgFromURL } = useCurrentOrgAndRepoFromURL()
  const personalOrg = usePersonalOrganization()
  const isOrgAdmin = useIsOrganizationAdmin(currentOrgFromURL)
  const isPersonal = currentOrgFromURL?.name === personalOrg?.name

  const routes = useDashboardRoutes(
    currentOrgFromURL,
    currentOrgFromURL ? isPersonal : true,
    isOrgAdmin ?? false,
  )

  const currentRoute = routes.find((r) => r.isActive)

  return (
    <>
      <DashboardBody>
        {isPersonal &&
          currentRoute &&
          'subs' in currentRoute &&
          (currentRoute.subs?.length ?? 0) > 0 && (
            <SubNav items={currentRoute.subs ?? []} />
          )}
        {children}
      </DashboardBody>
    </>
  )
}
