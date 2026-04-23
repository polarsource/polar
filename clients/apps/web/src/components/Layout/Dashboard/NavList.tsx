'use client'

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  useSidebar,
} from '@polar-sh/ui/components/atoms/Sidebar'
import Link from 'next/link'
import { ReactNode, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { RouteWithActive, SubRouteWithActive } from '../../Dashboard/navigation'

export type NavType = 'organization' | 'account'

type NavStyle = {
  activeItem: string
  activeIcon: string
  subBase: string
  activeSub: string
}

const NAV_STYLES: Record<NavType, NavStyle> = {
  organization: {
    activeItem:
      'dark:!bg-polar-900 dark:border-polar-800 border-gray-200 bg-white! text-black shadow-xs dark:text-white',
    activeIcon: 'text-black dark:text-white',
    subBase:
      'dark:text-polar-500 ml-4 inline-flex flex-row items-center gap-x-2 text-sm font-medium text-gray-500 transition-colors hover:text-black dark:hover:text-white',
    activeSub: 'text-black dark:text-white',
  },
  account: {
    activeItem:
      'dark:bg-polar-900 dark:border-polar-800 border-gray-200 bg-white text-black shadow-xs dark:text-white',
    activeIcon: 'text-blue-500 dark:text-white',
    subBase:
      'dark:text-polar-500 ml-4 inline-flex flex-row items-center gap-x-2 text-sm font-medium text-gray-500',
    activeSub: 'text-blue-500 dark:text-white',
  },
}

export const NavList = ({
  routes,
  navType,
  header,
}: {
  routes: RouteWithActive[]
  navType: NavType
  header?: ReactNode
}) => {
  const { state, isMobile, setOpenMobile } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const style = NAV_STYLES[navType]

  const [expandedRoute, setExpandedRoute] = useState<string | null>(
    () => routes.find((r) => r.isActive && r.subs)?.link ?? null,
  )

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <SidebarMenu>
      {header}
      {routes.map((route) => (
        <SidebarMenuItem key={route.link}>
          <SidebarMenuButton
            tooltip={route.title}
            asChild
            isActive={route.isActive}
          >
            <Link
              prefetch={true}
              className={twMerge(
                'flex flex-row items-center rounded-lg border border-transparent px-2 transition-colors dark:border-transparent',
                route.isActive
                  ? style.activeItem
                  : 'dark:text-polar-500 dark:hover:text-polar-200 text-gray-500 hover:text-black',
                isCollapsed && '!dark:text-polar-600',
              )}
              href={route.link}
              onClick={(e) => {
                if (!isMobile) return
                if (route.subs?.length) {
                  e.preventDefault()
                  setExpandedRoute((prev) =>
                    prev === route.link ? null : route.link,
                  )
                } else {
                  setOpenMobile(false)
                }
              }}
            >
              {'icon' in route && route.icon ? (
                <span
                  className={twMerge(
                    'flex flex-col items-center justify-center overflow-visible rounded-full bg-transparent text-[15px]',
                    route.isActive ? style.activeIcon : 'bg-transparent',
                  )}
                >
                  {route.icon}
                </span>
              ) : undefined}
              <span className="ml-2 text-sm font-medium">{route.title}</span>
            </Link>
          </SidebarMenuButton>
          {(isMobile ? expandedRoute === route.link : route.isActive) &&
            route.subs && (
              <SidebarMenuSub className="my-2 gap-y-2">
                {route.subs.map((subRoute: SubRouteWithActive) => (
                  <SidebarMenuSubItem key={subRoute.link}>
                    <Link
                      href={subRoute.link}
                      prefetch={true}
                      className={twMerge(
                        style.subBase,
                        subRoute.isActive && style.activeSub,
                      )}
                      onClick={closeOnMobile}
                    >
                      {subRoute.title}
                      {subRoute.extra}
                    </Link>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}
