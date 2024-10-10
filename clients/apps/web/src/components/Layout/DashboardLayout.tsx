'use client'

import LogoIcon from '@/components/Brand/LogoIcon'
import { useAuth } from '@/hooks/auth'
import { MaintainerOrganizationContext } from '@/providers/maintainerOrganization'
import { organizationPageLink } from '@/utils/nav'
import { CloseOutlined, ShortTextOutlined } from '@mui/icons-material'
import { Repository } from '@polar-sh/sdk'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Button from 'polarkit/components/ui/atoms/button'
import { Tabs, TabsList, TabsTrigger } from 'polarkit/components/ui/atoms/tabs'
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
import { CommandPaletteTrigger } from '../CommandPalette/CommandPaletteTrigger'
import MaintainerNavigation from '../Dashboard/DashboardNavigation'
import { DashboardProvider, useDashboard } from '../Dashboard/DashboardProvider'
import MaintainerRepoSelection from '../Dashboard/MaintainerRepoSelection'
import { SubRouteWithActive } from '../Dashboard/navigation'
import DashboardProfileDropdown from '../Navigation/DashboardProfileDropdown'
import DashboardTopbar from '../Navigation/DashboardTopbar'
import { useRoute } from '../Navigation/useRoute'
import { BrandingMenu } from './Public/BrandingMenu'
import TopbarRight from './Public/TopbarRight'

const DashboardSidebar = () => {
  const [scrollTop, setScrollTop] = useState(0)
  const { currentUser } = useAuth()

  const { showCommandPalette } = useDashboard()

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
        'flex h-full w-full flex-shrink-0 flex-col justify-between gap-y-4 overflow-y-auto md:w-[240px] md:overflow-y-visible',
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
          <div className="flex flex-col">
            <div className="flex">
              <CommandPaletteTrigger
                title="Documentation"
                className="w-full cursor-text"
                onClick={showCommandPalette}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

const DashboardLayout = (props: PropsWithChildren<{ className?: string }>) => {
  const { organization } = useContext(MaintainerOrganizationContext)
  return (
    <DashboardProvider organization={organization}>
      <div className="relative flex h-full w-full flex-col gap-x-8 bg-gray-100 md:flex-row md:p-6 dark:bg-transparent">
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
          <DashboardTopbar />
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
          {mobileNavOpen ? <CloseOutlined /> : <ShortTextOutlined />}
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

export const RepoPickerHeader = (props: {
  currentRepository?: Repository
  repositories: Repository[]
  children?: React.ReactNode
}) => {
  const onSubmit = () => {}

  return (
    <>
      <form
        className="dark:border-polar-700 flex flex-row items-center justify-between space-x-4 space-y-0 bg-transparent"
        onSubmit={onSubmit}
      >
        <MaintainerRepoSelection
          current={props.currentRepository}
          repositories={props.repositories}
        />
        {props.children}
      </form>
    </>
  )
}

const SubNav = (props: { items: SubRouteWithActive[] }) => {
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

export const DashboardBody = ({
  children,
  className,
  title,
  contextView,
  header = true,
}: {
  children?: React.ReactNode
  className?: string
  title?: string
  contextView?: React.ReactElement
  header?: boolean
}) => {
  const currentRoute = useRoute()

  const hasCurrent = (currentRoute?.subs as SubRouteWithActive[])?.some(
    (i) => i.isActive,
  )

  return (
    <div className={twMerge('flex h-full w-full flex-row gap-x-6')}>
      <div className="dark:md:bg-polar-900 dark:border-polar-700 relative flex w-full flex-col items-center rounded-2xl border-gray-200 px-4 md:overflow-y-auto md:border md:bg-gray-50 md:px-12 md:shadow-sm">
        <div className="flex h-full w-full max-w-screen-xl flex-col">
          {header && (
            <div className="flex w-full flex-col gap-y-4 py-8 md:flex-row md:items-center md:justify-between md:py-12">
              <h4 className="whitespace-nowrap text-2xl font-medium dark:text-white">
                {title ?? currentRoute?.title}
              </h4>

              {currentRoute &&
              'subs' in currentRoute &&
              hasCurrent &&
              (currentRoute.subs?.length ?? 0) > 0 ? (
                <div className="flex flex-row items-center gap-4 gap-y-24">
                  <SubNav items={currentRoute.subs ?? []} />
                </div>
              ) : null}
            </div>
          )}
          <div className={twMerge('flex w-full flex-col pb-8', className)}>
            {children}
          </div>
        </div>
      </div>
      {contextView ? (
        <div className="dark:bg-polar-900 dark:border-polar-700 w-full max-w-[440px] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50">
          {contextView}
        </div>
      ) : null}
    </div>
  )
}

export const DashboardPaddingX = (props: {
  children?: React.ReactNode
  className?: string
}) => {
  return (
    <div className={twMerge('px-4 sm:px-6 md:px-8', props.className)}>
      {props.children}
    </div>
  )
}
