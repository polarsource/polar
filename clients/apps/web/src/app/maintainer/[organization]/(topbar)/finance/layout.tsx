'use client'

import { dashboardRoutes } from '@/components/Dashboard/navigation'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import { SubNav } from '@/components/Navigation/DashboardTopbar'
import {
  useCurrentOrgAndRepoFromURL,
  useIsOrganizationAdmin,
  usePersonalOrganization,
} from '@/hooks'
import { usePathname } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { org: currentOrgFromURL } = useCurrentOrgAndRepoFromURL()
  const personalOrg = usePersonalOrganization()
  const pathname = usePathname()
  const isOrgAdmin = useIsOrganizationAdmin(currentOrgFromURL)
  const isPersonal = currentOrgFromURL?.name === personalOrg?.name

  const routes = currentOrgFromURL
    ? dashboardRoutes(
        currentOrgFromURL,
        currentOrgFromURL ? isPersonal : true,
        isOrgAdmin ?? false,
      )
    : []

  const [currentRoute] = routes.filter((route) =>
    pathname?.startsWith(route.link),
  )

  return (
    <>
      <DashboardBody>
        {isPersonal &&
          currentRoute &&
          'subs' in currentRoute &&
          (currentRoute.subs?.length ?? 0) > 0 && (
            <SubNav
              items={
                currentRoute.subs?.map((sub) => ({
                  ...sub,
                  active: sub.link === pathname,
                })) ?? []
              }
            />
          )}
        {children}
      </DashboardBody>
    </>
  )
}
