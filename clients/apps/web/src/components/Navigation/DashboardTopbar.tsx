'use client'

import { useAuth } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { organizationPageLink } from 'polarkit/utils/nav'
import {
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import {
  Route,
  SubRoute,
  dashboardRoutes,
  maintainerRoutes,
} from '../Dashboard/navigation'
import DashboardLayoutContext from '../Layout/DashboardLayoutContext'
import TopbarRight from '../Layout/Public/TopbarRight'

export type LogoPosition = 'center' | 'left'

export const SubNav = (props: {
  items: (SubRoute & { active: boolean })[]
}) => {
  const current = props.items.find((i) => i.active)

  return (
    <Tabs defaultValue={current?.title}>
      <TabsList
        className="
          flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0"
      >
        {props.items.map((item) => {
          return (
            <Link key={item.title} href={item.link}>
              <TabsTrigger value={item.title} size="small">
                {item.icon && <div className="text-[17px]">{item.icon}</div>}
                <div>{item.title}</div>
              </TabsTrigger>
            </Link>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

const DashboardTopbar = ({
  children,
  title,
  hideProfile,
  ...props
}: PropsWithChildren<{
  title?: string
  useOrgFromURL: boolean
  hideProfile?: boolean
  isFixed?: boolean
}>) => {
  const { currentUser } = useAuth()
  const pathname = usePathname()

  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization
  const personalOrg = orgContext?.personalOrganization
  const adminOrgs = orgContext?.adminOrganizations ?? []
  const isOrgAdmin = adminOrgs.some((o) => org && o.id === org.id)
  const isPersonal = Boolean(org && personalOrg && org.id === personalOrg.id)

  const getRoutes = (currentOrg?: Organization): Route[] => {
    return [
      ...(currentOrg ? maintainerRoutes(currentOrg) : []),
      ...(currentOrg
        ? dashboardRoutes(
            currentOrg,
            currentOrg ? isPersonal : true,
            isOrgAdmin ?? false,
          )
        : []),
    ]
  }

  const routes = getRoutes(org)

  const [currentRoute] = routes.filter((route) =>
    pathname?.startsWith(route.link),
  )

  const className = twMerge(
    props.isFixed !== false ? 'md:fixed z-20 left-0 top-0 right-0' : '',
    'flex h-fit md:min-h-20 w-full items-center justify-between space-x-4 bg-white dark:bg-polar-900 border-b border-gray-100 dark:border-polar-800',
  )

  // Detect height changes of the topbar and propagate it to the context
  const { setTopbarHeight, setIsMD } = useContext(DashboardLayoutContext)
  const [domNode, setDomNode] = useState<HTMLDivElement | null>(null)

  const propagateHeight = (toolbar: HTMLDivElement) => {
    if (!toolbar) {
      return
    }

    setIsMD(window.innerWidth >= 768)
    setTopbarHeight(toolbar.clientHeight)
  }

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (domNode) {
        propagateHeight(domNode)
      }
    })

    if (domNode) {
      resizeObserver.observe(domNode)
    }

    return () => {
      if (domNode) {
        resizeObserver.unobserve(domNode)
      }
    }
  }, [domNode])

  const onRefChange = useCallback((target: HTMLDivElement) => {
    setDomNode(target)
    propagateHeight(target)
  }, [])

  return (
    <>
      <div className={className} ref={onRefChange}>
        <div className="mx-auto flex w-full max-w-screen-xl flex-row flex-wrap items-center justify-start gap-x-4 gap-y-2 px-4 py-4 sm:px-6 md:gap-x-12 md:px-8 xl:gap-x-24">
          <h4 className="dark:text-polar-100 whitespace-nowrap  text-lg font-medium ">
            {title ?? currentRoute?.title}
          </h4>
          <div className="flex flex-col gap-4  md:flex-row md:items-center md:gap-y-24">
            {currentRoute &&
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
          </div>
          <div className="flex w-full flex-1 flex-row items-center justify-end gap-x-6 md:justify-end">
            {children}
            {org ? (
              <Link href={organizationPageLink(org)}>
                <Button>
                  <div className="flex flex-row items-center gap-x-2">
                    <span className="whitespace-nowrap text-xs">
                      Public Page
                    </span>
                  </div>
                </Button>
              </Link>
            ) : null}
            <TopbarRight authenticatedUser={currentUser} />
          </div>
        </div>
      </div>
    </>
  )
}
export default DashboardTopbar
