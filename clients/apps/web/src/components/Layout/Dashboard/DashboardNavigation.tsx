'use client'

import { ArrowBack } from '@polar-sh/orbit/icons'
import { schemas } from '@polar-sh/client'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@polar-sh/ui/components/atoms/Sidebar'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CatalogVersionSelector } from '../../Catalog/CatalogVersionSelector'
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
import { useSettingsRouteGroups } from '../../Dashboard/navigationSettings'
import { NavList } from './NavList'

export const useIsSettingsPath = (organization?: schemas['Organization']) => {
  const pathname = usePathname()
  return (
    !!organization &&
    pathname.startsWith(`/dashboard/${organization.slug}/settings`)
  )
}

export const SettingsNavigationHeader = ({
  organization,
}: {
  organization: schemas['Organization']
}) => (
  <SidebarMenu>
    <BackLink href={`/dashboard/${organization.slug}`} title="Settings" />
  </SidebarMenu>
)

export const OrganizationNavigation = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const productNavEnabled = useProductNavigationEnabled(organization)

  if (useIsSettingsPath(organization)) {
    return <SettingsNavigation organization={organization} />
  }

  return (
    <>
      <CatalogVersionSelector organization={organization} />
      {productNavEnabled ? (
        <ProductNavigation organization={organization} />
      ) : (
        <LegacyOrganizationNavigation organization={organization} />
      )}
    </>
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

const BackLink = ({ href, title }: { href: string; title: string }) => {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem className="mb-4 flex flex-row items-center gap-2">
      <SidebarMenuButton tooltip="Back to Dashboard" asChild>
        <Link
          href={href}
          className="flex flex-row items-center gap-4 border border-transparent text-black dark:text-white"
          onClick={() => {
            if (isMobile) setOpenMobile(false)
          }}
        >
          <span className="flex flex-col items-center justify-center overflow-visible rounded-full bg-transparent text-[15px]">
            <ArrowBack fontSize="inherit" />
          </span>
          <span>{title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

const SettingsNavigation = ({
  organization,
}: {
  organization: schemas['Organization']
}) => {
  const groups = useSettingsRouteGroups(organization)

  return (
    <div className="flex w-full flex-col gap-6">
      {groups.map((group, index) => (
        <div key={group.title} className="flex w-full flex-col gap-2">
          {index > 0 && (
            <span className="dark:text-polar-500 px-2 text-xs font-medium text-gray-400">
              {group.title}
            </span>
          )}
          <NavList routes={group.routes} navType="organization" />
        </div>
      ))}
    </div>
  )
}

export const AccountNavigation = () => {
  const routes = useAccountRoutes()

  return (
    <NavList
      routes={routes}
      navType="account"
      header={<BackLink href="/dashboard" title="Account Settings" />}
    />
  )
}
