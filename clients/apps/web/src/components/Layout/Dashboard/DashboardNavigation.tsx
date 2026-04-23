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
import { NavList } from './NavList'

export const OrganizationNavigation = ({
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
              <span>Account Settings</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      }
    />
  )
}
