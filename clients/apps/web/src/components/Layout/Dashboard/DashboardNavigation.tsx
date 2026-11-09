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
import { twMerge } from 'tailwind-merge'
import { usePathname } from 'next/navigation'
import {
  useAccountRoutes,
  useGeneralRoutes,
  useOrganizationRoutes,
} from '../../Dashboard/navigation'
import { useSettingsRouteGroups } from '../../Dashboard/navigationSettings'
import { CatalogNavigation } from './CatalogNavigation'
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
  if (useIsSettingsPath(organization)) {
    return <SettingsNavigation organization={organization} />
  }

  if (organization.feature_settings?.config_as_code_enabled) {
    return <CatalogNavigation organization={organization} />
  }

  return <StandardOrganizationNavigation organization={organization} />
}

const StandardOrganizationNavigation = ({
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

const BackLink = ({
  href,
  title,
  className,
}: {
  href: string
  title: string
  className?: string
}) => {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem
      className={twMerge('flex flex-row items-center gap-2', className)}
    >
      <SidebarMenuButton tooltip="Back to Dashboard" asChild>
        <Link
          href={href}
          className="dark:hover:bg-polar-900! flex flex-row items-center gap-4 rounded-lg px-2 text-black transition-colors duration-75 hover:bg-white! dark:text-white"
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
      header={
        <BackLink href="/dashboard" title="Account Settings" className="mb-4" />
      }
    />
  )
}
