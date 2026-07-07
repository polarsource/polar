'use client'

import ArrowBack from '@mui/icons-material/ArrowBack'
import { schemas } from '@polar-sh/client'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@polar-sh/ui/components/atoms/Sidebar'
import Link from 'next/link'
import {
  useAccountRoutes,
  useGeneralRoutes,
  useOrganizationRoutes,
} from '../../Dashboard/navigation'
import {
  useBillingRoutes,
  useInsightsRoutes,
  useProductNavigationEnabled,
} from '../../Dashboard/navigationProducts'
import { NavList } from './NavList'

export const OrganizationNavigation = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const productNavEnabled = useProductNavigationEnabled(organization)

  return productNavEnabled ? (
    <ProductNavigation organization={organization} />
  ) : (
    <LegacyOrganizationNavigation organization={organization} />
  )
}

const LegacyOrganizationNavigation = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const routes = [
    ...useGeneralRoutes(organization),
    ...useOrganizationRoutes(organization),
  ]
  return <NavList routes={routes} navType="organization" />
}

const ProductNavigation = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const insightsRoutes = useInsightsRoutes(organization)
  const billingRoutes = useBillingRoutes(organization)
  const settingsRoutes = useOrganizationRoutes(organization).filter(
    (route) => route.id === 'settings',
  )

  return (
    <div className="flex w-full flex-col gap-6">
      <NavList routes={insightsRoutes} navType="organization" />
      <div className="flex w-full flex-col gap-2">
        <span className="dark:text-polar-500 px-2 text-xs font-medium text-gray-400">
          Billing
        </span>
        <NavList
          routes={[...billingRoutes, ...settingsRoutes]}
          navType="organization"
        />
      </div>
    </div>
  )
}

export const AccountNavigation = () => {
  const routes = useAccountRoutes()
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <NavList
      routes={routes}
      navType="account"
      header={
        <SidebarMenuItem className="mb-4 flex flex-row items-center gap-2">
          <SidebarMenuButton tooltip="Back to Dashboard" asChild>
            <Link
              href="/dashboard"
              className="flex flex-row items-center gap-4 border border-transparent text-black dark:text-white"
              onClick={() => {
                if (isMobile) setOpenMobile(false)
              }}
            >
              <span className="flex flex-col items-center justify-center overflow-visible rounded-full bg-transparent text-[15px]">
                <ArrowBack fontSize="inherit" />
              </span>
              <span>User Settings</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      }
    />
  )
}
