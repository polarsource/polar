'use client'

import { useAuth } from '@/hooks'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { organizationPageLink } from '@/utils/nav'
import { KeyboardArrowRight } from '@mui/icons-material'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
import { useCallback, useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { SubRouteWithActive } from '../Dashboard/navigation'
import TopbarRight from '../Layout/Public/TopbarRight'
import { isUUID } from './utils'

export type LogoPosition = 'center' | 'left'

export const SubNav = (props: { items: SubRouteWithActive[] }) => {
  const current = props.items.find((i) => i.isActive)

  return (
    <Tabs className="md:-mx-4" value={current?.title}>
      <TabsList
        className="
          flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0"
      >
        {props.items.map((item) => {
          return (
            <Link key={item.title} href={item.link}>
              <TabsTrigger
                className="flex flex-row items-center gap-x-2 px-4"
                value={item.title}
              >
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

const DashboardTopbar = () => {
  const { currentUser } = useAuth()

  const orgContext = useContext(MaintainerOrganizationContext)
  const org = orgContext?.organization
  const pathname = usePathname()

  const Breadcrumbs = useCallback(() => {
    return (
      <div className="text-xxs flex flex-row items-center gap-x-0.5 font-mono">
        {pathname
          .split('/')
          .filter(Boolean)
          .flatMap((path, index, arr) => {
            const href = arr.slice(0, index + 1).join('/')
            const normalizePath = !isUUID(path) && path !== org.slug
            const isCurrent = index === arr.length - 1

            const link = (
              <Link
                key={path}
                href={`/${href}`}
                className={twMerge(
                  'dark:text-polar-500 dark:hover:bg-polar-800 rounded-md px-2 py-1 text-gray-500 transition-colors hover:bg-gray-50 hover:text-black dark:hover:text-white',
                  normalizePath ? 'capitalize' : 'lowercase',
                  isCurrent
                    ? 'dark:bg-polar-800 bg-gray-50 text-black shadow-sm dark:text-white'
                    : '',
                )}
              >
                {path}
              </Link>
            )

            return arr.length - 1 !== index
              ? [
                  link,
                  <KeyboardArrowRight
                    className="dark:text-polar-500 text-sm text-gray-500"
                    key={path + 'sep'}
                    fontSize="inherit"
                  />,
                ]
              : link
          })}
      </div>
    )
  }, [pathname])

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-row items-center justify-between gap-x-8">
        <div className="flex w-full flex-grow flex-row items-center gap-x-8">
          <Breadcrumbs />
        </div>
        <div className="flex flex-row items-center gap-x-6">
          {org.profile_settings?.enabled ? (
            <Link href={organizationPageLink(org)}>
              <Button>
                <div className="flex flex-row items-center gap-x-2">
                  <span className="whitespace-nowrap text-xs">Storefront</span>
                </div>
              </Button>
            </Link>
          ) : null}
          <TopbarRight authenticatedUser={currentUser} />
        </div>
      </div>
    </div>
  )
}
export default DashboardTopbar
