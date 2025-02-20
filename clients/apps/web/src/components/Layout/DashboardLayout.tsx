'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { useAuth } from '@/hooks/auth'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { setLastVisitedOrg } from '@/utils/cookies'
import { organizationPageLink } from '@/utils/nav'
import { schemas } from '@polar-sh/client'
import Button from '@polar-sh/ui/components/atoms/Button'
import { Tabs, TabsList, TabsTrigger } from '@polar-sh/ui/components/atoms/Tabs'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PropsWithChildren,
  UIEventHandler,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import MaintainerNavigation from '../Dashboard/DashboardNavigation'
import { DashboardProvider } from '../Dashboard/DashboardProvider'
import { SubRouteWithActive } from '../Dashboard/navigation'
import DashboardProfileDropdown from '../Navigation/DashboardProfileDropdown'
import PublicProfileDropdown from '../Navigation/PublicProfileDropdown'
import { useRoute } from '../Navigation/useRoute'
import { NotificationsPopover } from '../Notifications/NotificationsPopover'
import { BrandingMenu } from './Public/BrandingMenu'
import TopbarRight from './Public/TopbarRight'

const DashboardSidebar = () => {
  const [scrollTop, setScrollTop] = useState(0)
  const { currentUser } = useAuth()

  const handleScroll: UIEventHandler<HTMLDivElement> = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const shouldRenderUpperBorder = useMemo(() => scrollTop > 0, [scrollTop])

  const upperScrollClassName = shouldRenderUpperBorder
    ? 'border-b dark:border-b-polar-700 border-b-gray-200'
    : ''

  if (!currentUser) {
    return <></>
  }

  return (
    <aside
      className={twMerge(
        'flex h-full w-full flex-shrink-0 flex-col justify-between gap-y-4 overflow-y-auto md:w-[220px] md:overflow-y-visible',
      )}
    >
      <div className="flex h-full flex-col gap-y-6">
        <div className="hidden md:flex">
          <BrandingMenu />
        </div>

        <div className={upperScrollClassName}>
          <DashboardProfileDropdown />
        </div>

        <div
          className="flex w-full flex-grow flex-col gap-y-12 md:h-full md:justify-between md:overflow-y-auto"
          onScroll={handleScroll}
        >
          <div className="flex flex-col gap-y-12">
            <MaintainerNavigation />
          </div>
        </div>
      </div>
      <DashboardBottom authenticatedUser={currentUser} />
    </aside>
  )
}

const DashboardBottom = ({
  authenticatedUser,
}: {
  authenticatedUser: schemas['UserRead']
}) => {
  return (
    <div className="flex flex-row items-center justify-between gap-x-5">
      <div className="flex w-full min-w-0 flex-grow-0 flex-row items-center gap-x-2">
        <PublicProfileDropdown
          authenticatedUser={authenticatedUser}
          anchor="bottombar"
        />
        <div className="flex w-full min-w-0 flex-col">
          <span className="w-full truncate text-xs">
            {authenticatedUser.email}
          </span>
          <span className="dark:text-polar-500 text-xs text-gray-500">
            User Account
          </span>
        </div>
      </div>
      <NotificationsPopover />
    </div>
  )
}

const DashboardLayout = (
  props: PropsWithChildren<{
    className?: string
  }>,
) => {
  const { organization } = useContext(MaintainerOrganizationContext)

  useEffect(() => {
    if (organization) setLastVisitedOrg(organization.slug)
  }, [organization])

  return (
    <DashboardProvider organization={organization}>
      <div className="relative flex h-full w-full flex-col gap-x-8 bg-gray-100 md:flex-row md:p-4 dark:bg-transparent">
        <MobileNav />
        <div className="hidden md:flex">
          <DashboardSidebar />
        </div>
        <div
          className={twMerge(
            'relative flex h-full w-full flex-col gap-y-4',
            props.className,
          )}
        >
          {/* On large devices, scroll here. On small devices the _document_ is the only element that should scroll. */}
          <main className="relative flex min-h-0 w-full flex-grow flex-col">
            {props.children}
          </main>
        </div>
      </div>
    </DashboardProvider>
  )
}

export default DashboardLayout

const MobileNav = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pathname = usePathname()
  const { organization } = useContext(MaintainerOrganizationContext)
  const { currentUser } = useAuth()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const header = (
    <div className="dark:bg-polar-900 sticky left-0 right-0 top-0 flex w-full flex-row items-center justify-between bg-gray-50 p-4">
      <a
        href="/"
        className="flex-shrink-0 items-center font-semibold text-black dark:text-white"
      >
        <LogoIcon className="h-10 w-10" />
      </a>

      <div className="flex flex-row items-center gap-x-6">
        {organization.profile_settings?.enabled ? (
          <Link href={organizationPageLink(organization)}>
            <Button>
              <div className="flex flex-row items-center gap-x-2">
                <span className="whitespace-nowrap text-xs">Storefront</span>
              </div>
            </Button>
          </Link>
        ) : null}
        <TopbarRight authenticatedUser={currentUser} />
        <div
          className="dark:text-polar-200 flex flex-row items-center justify-center text-gray-700"
          onClick={() => setMobileNavOpen((toggle) => !toggle)}
        >
          {mobileNavOpen ? <X /> : <Menu />}
        </div>
      </div>
    </div>
  )

  return (
    <div className="dark:bg-polar-900 relative z-20 flex w-screen flex-col items-center justify-between bg-gray-50 md:hidden">
      {mobileNavOpen ? (
        <div className="relative flex h-full w-full flex-col">
          {header}
          <div className="dark:bg-polar-900 flex h-full flex-col bg-gray-50 px-4">
            <DashboardSidebar />
          </div>
        </div>
      ) : (
        header
      )}
    </div>
  )
}

const SubNav = (props: { items: SubRouteWithActive[] }) => {
  const current = props.items.find((i) => i.isActive)

  return (
    <Tabs className="md:-mx-4" value={current?.title}>
      <TabsList className="flex flex-row bg-transparent ring-0 dark:bg-transparent dark:ring-0">
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

export const DashboardBody = ({
  children,
  className,
  wrapperClassName,
  title,
  contextView,
  contextViewClassName,
  header = true,
  wide = false,
  transparent = false,
}: {
  children?: React.ReactNode
  wrapperClassName?: string
  className?: string
  title?: JSX.Element | string
  contextView?: React.ReactElement
  contextViewClassName?: string
  header?: JSX.Element | boolean
  wide?: boolean
  transparent?: boolean
}) => {
  const currentRoute = useRoute()
  const [scrolled, setScrolled] = useState(false)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const hasScrolled = e.currentTarget.scrollTop > 1

    if (hasScrolled !== scrolled) {
      setScrolled(hasScrolled)
    }
  }

  const hasCurrent = (currentRoute?.subs as SubRouteWithActive[])?.some(
    (i) => i.isActive,
  )

  return (
    <div className={twMerge('flex h-full w-full flex-row gap-x-3')}>
      <div
        onScroll={handleScroll}
        className={twMerge(
          'relative flex w-full flex-col items-center px-4 md:overflow-y-auto',
          transparent
            ? 'bg-transparent dark:bg-transparent'
            : 'dark:md:bg-polar-900 dark:border-polar-800 rounded-2xl border-gray-200 md:border md:bg-white md:px-12 md:shadow-sm',
          transparent && scrolled
            ? 'dark:border-polar-700 border-t border-gray-200'
            : '',
        )}
      >
        <div
          className={twMerge(
            'flex h-full w-full flex-col',
            wrapperClassName,
            wide ? '' : 'max-w-screen-xl',
          )}
        >
          {header && (
            <div
              className={twMerge(
                'flex w-full flex-col gap-y-4 py-8 md:flex-row md:items-center md:justify-between',
                transparent ? '' : 'md:py-12',
              )}
            >
              <h4 className="whitespace-nowrap text-2xl font-medium dark:text-white">
                {title ?? currentRoute?.title}
              </h4>

              {typeof header === 'boolean' &&
              currentRoute &&
              'subs' in currentRoute &&
              hasCurrent &&
              (currentRoute.subs?.length ?? 0) > 0 ? (
                <div className="flex flex-row items-center gap-4 gap-y-24">
                  <SubNav items={currentRoute.subs ?? []} />
                </div>
              ) : (
                header
              )}
            </div>
          )}
          <div className={twMerge('flex w-full flex-col pb-8', className)}>
            {children}
          </div>
        </div>
      </div>
      {contextView ? (
        <div
          className={twMerge(
            'dark:bg-polar-900 dark:border-polar-800 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white md:max-w-[320px] md:shadow-sm xl:max-w-[440px]',
            contextViewClassName,
          )}
        >
          {contextView}
        </div>
      ) : null}
    </div>
  )
}
