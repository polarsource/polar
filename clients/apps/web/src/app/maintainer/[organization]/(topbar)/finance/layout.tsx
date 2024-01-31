'use client'

import { Route, dashboardRoutes } from '@/components/Dashboard/navigation'
import { DashboardBody } from '@/components/Layout/DashboardLayout'
import DashboardTopbar, { SubNav } from '@/components/Shared/DashboardTopbar'
import {
  useCurrentOrgAndRepoFromURL,
  useIsOrganizationAdmin,
  usePersonalOrganization,
} from '@/hooks'
import { Organization } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { org: currentOrgFromURL } = useCurrentOrgAndRepoFromURL()
  const personalOrg = usePersonalOrganization()
  const pathname = usePathname()
  const isOrgAdmin = useIsOrganizationAdmin(currentOrgFromURL)
  const isPersonal = currentOrgFromURL?.name === personalOrg?.name

  const getRoutes = (
    pathname: string | null,
    currentOrg?: Organization,
  ): Route[] => {
    return [
      ...(currentOrg ? dashboardRoutes(currentOrg) : []),
      ...dashboardRoutes(
        currentOrg,
        currentOrg ? isPersonal : true,
        isOrgAdmin,
      ),
    ]
  }

  const routes = getRoutes(pathname, currentOrgFromURL)

  const [currentRoute] = routes.filter(
    (route) => pathname?.startsWith(route.link),
  )

  return (
    <>
      <DashboardTopbar isFixed useOrgFromURL />
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
