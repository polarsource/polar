'use client'

import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@polar-sh/ui/components/atoms/Sidebar'
import Link from 'next/link'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  useFundingRoutes,
  useGeneralRoutes,
  useOrganizationRoutes,
} from '../../Dashboard/navigation'

const MaintainerNavigation = () => {
  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization

  const generalRoutesList = useGeneralRoutes(org)
  const fundingRoutes = useFundingRoutes(org)
  const organizationRoutes = useOrganizationRoutes(org)

  const { state } = useSidebar()

  const isCollapsed = state === 'collapsed'

  const dashboardRoutes = [
    ...generalRoutesList,
    ...fundingRoutes,
    ...organizationRoutes,
  ]

  if (!org) {
    return <></>
  }

  return (
    <SidebarMenu>
      {dashboardRoutes.map((route) => (
        <SidebarMenuItem key={route.link}>
          <SidebarMenuButton tooltip={route.title} asChild>
            <Link
              key={route.link}
              className={twMerge(
                'flex flex-row items-center rounded-lg border border-transparent px-2 transition-colors dark:border-transparent',
                route.isActive
                  ? 'dark:bg-polar-900 dark:border-polar-800 border-gray-200 bg-white text-black shadow-sm dark:text-white'
                  : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-black',
                isCollapsed && '!dark:text-polar-600',
              )}
              href={route.link}
            >
              {'icon' in route && route.icon ? (
                <span
                  className={twMerge(
                    'flex flex-col items-center justify-center overflow-visible rounded-full bg-transparent text-[15px]',
                    route.isActive
                      ? 'text-blue-500 dark:text-white'
                      : 'bg-transparent',
                  )}
                >
                  {route.icon}
                </span>
              ) : undefined}
              <span className="ml-2 text-sm font-medium">{route.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

export default MaintainerNavigation
