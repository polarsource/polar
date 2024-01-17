'use client'

import {
  useCurrentOrgAndRepoFromURL,
  useGitHubAccount,
  useIsOrganizationAdmin,
  usePersonalOrganization,
} from '@/hooks'
import { useAuth } from '@/hooks/auth'
import { CloseOutlined, ShortTextOutlined } from '@mui/icons-material'
import { Repository } from '@polar-sh/sdk'
import { usePathname } from 'next/navigation'
import { LogoIcon } from 'polarkit/components/brand'
import {
  useListAdminOrganizations,
  useOrganizationSubscriptions,
  useUserSubscriptions,
} from 'polarkit/hooks'
import {
  PropsWithChildren,
  Suspense,
  UIEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'
import BackerNavigation from '../Dashboard/BackerNavigation'
import DashboardNavigation from '../Dashboard/DashboardNavigation'
import MaintainerNavigation from '../Dashboard/MaintainerNavigation'
import MaintainerRepoSelection from '../Dashboard/MaintainerRepoSelection'
import MetaNavigation from '../Dashboard/MetaNavigation'
import { MySubscriptionsNavigation } from '../Dashboard/MySubscriptionsNavigation'
import { GitHubAuthUpsell, MaintainerUpsell } from '../Dashboard/Upsell'
import Popover from '../Notifications/Popover'
import ProfileSelection from '../Shared/ProfileSelection'

const DashboardSidebar = () => {
  const [scrollTop, setScrollTop] = useState(0)
  const { currentUser } = useAuth()
  const { org: currentOrg, isLoaded: isCurrentOrgLoaded } =
    useCurrentOrgAndRepoFromURL()
  const listOrganizationQuery = useListAdminOrganizations()
  const personalOrg = usePersonalOrganization()

  const userSubscriptions = useUserSubscriptions(
    currentUser?.id,
    undefined,
    9999,
  )

  const orgSubscriptions = useOrganizationSubscriptions(
    currentOrg?.id,
    undefined,
    9999,
  )

  const orgs = listOrganizationQuery?.data?.items

  const isOrgAdmin = useIsOrganizationAdmin(currentOrg)

  const shouldRenderBackerNavigation = currentOrg
    ? currentOrg.name === currentUser?.username || currentOrg.is_teams_enabled
    : true

  const shouldRenderMaintainerNavigation = currentOrg
    ? isOrgAdmin
    : orgs?.some((org) => org.name === currentUser?.username)

  const shouldRenderDashboardNavigation = currentOrg ? isOrgAdmin : true

  const githubAccount = useGitHubAccount()
  const shouldShowGitHubAuthUpsell = !githubAccount

  const shouldShowMaintainerUpsell =
    isCurrentOrgLoaded &&
    !listOrganizationQuery.isLoading &&
    !currentOrg &&
    !personalOrg

  const subscriptionsToRender =
    (currentOrg && currentOrg.id !== personalOrg?.id
      ? orgSubscriptions.data?.items?.flatMap((item) => item.subscription_tier)
      : userSubscriptions.data?.items?.flatMap(
          (item) => item.subscription_tier,
        )) ?? []

  const handleScroll: UIEventHandler<HTMLDivElement> = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])
  const shouldRenderBorder = useMemo(() => scrollTop > 0, [scrollTop])
  const scrollClassName = useMemo(
    () =>
      shouldRenderBorder
        ? 'border-b dark:border-b-polar-800 border-b-gray-100'
        : '',
    [shouldRenderBorder],
  )

  return (
    <aside
      className={twMerge(
        'dark:bg-polar-900 dark:border-r-polar-800 flex h-full w-full flex-shrink-0 flex-col justify-between gap-y-4 border-r border-r-gray-100 bg-white md:w-[320px]',
      )}
    >
      <div className="flex h-full flex-col">
        <div className={scrollClassName}>
          <div className="relative z-10 mt-5 hidden translate-x-0 flex-row items-center justify-between space-x-2 pl-7 pr-8 md:flex">
            <a
              href="/"
              className="flex-shrink-0 items-center font-semibold text-blue-500 dark:text-blue-400"
            >
              <LogoIcon className="h-10 w-10" />
            </a>

            <Suspense>{currentUser && <Popover type="dashboard" />}</Suspense>
          </div>
          <div className="mb-4 mt-8 flex px-4">
            {currentUser && (
              <ProfileSelection useOrgFromURL={true} className="shadow-xl" />
            )}
          </div>
        </div>

        <div
          className="flex h-full w-full flex-grow flex-col gap-y-2 overflow-y-auto"
          onScroll={handleScroll}
        >
          {shouldRenderBackerNavigation && <BackerNavigation />}

          {shouldRenderMaintainerNavigation && <MaintainerNavigation />}

          {shouldRenderDashboardNavigation && <DashboardNavigation />}

          {shouldShowGitHubAuthUpsell ? (
            <div className="flex flex-col pt-4">
              <GitHubAuthUpsell />
            </div>
          ) : shouldShowMaintainerUpsell ? (
            <div className="flex flex-col pt-4">
              <MaintainerUpsell />
            </div>
          ) : null}

          {subscriptionsToRender.length > 0 && (
            <MySubscriptionsNavigation
              subscriptionTiers={subscriptionsToRender}
            />
          )}
        </div>
        <div className="dark:border-t-polar-800 flex flex-col gap-y-2 border-t border-t-gray-100">
          <MetaNavigation />
        </div>
      </div>
    </aside>
  )
}

const DashboardLayout = (props: PropsWithChildren) => {
  const { hydrated } = useAuth()

  if (!hydrated) {
    return <></>
  }

  return (
    <>
      <div className="relative flex h-full w-full flex-col md:flex-row">
        <MobileNav />
        <div className="hidden md:flex">
          <DashboardSidebar />
        </div>
        <div className="dark:bg-polar-950 bg-gray-75 relative flex h-full w-full translate-x-0 flex-row overflow-hidden pt-8 md:pt-0">
          <main className={twMerge('relative w-full overflow-auto md:mt-20')}>
            <Suspense>{props.children}</Suspense>
          </main>
        </div>
      </div>
    </>
  )
}

export default DashboardLayout

const MobileNav = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const header = (
    <div className="dark:bg-polar-900 fixed left-0 right-0 top-0 flex flex-row items-center justify-between bg-white px-2 py-4 sm:px-3 md:px-4">
      <a
        href="/"
        className="flex-shrink-0 items-center font-semibold text-blue-500 dark:text-blue-400"
      >
        <LogoIcon className="h-10 w-10" />
      </a>

      <div
        className="dark:text-polar-200 flex flex-row items-center justify-center text-gray-700"
        onClick={() => setMobileNavOpen((toggle) => !toggle)}
      >
        {mobileNavOpen ? <CloseOutlined /> : <ShortTextOutlined />}
      </div>
    </div>
  )

  return (
    <div className="dark:bg-polar-900 relative z-10 flex flex-row items-center justify-between space-x-2 bg-white px-4 py-5 sm:px-6 md:hidden md:px-8">
      {mobileNavOpen ? (
        <div className="relative flex h-full w-full flex-col">
          <div className="fixed inset-0 z-10 flex h-full flex-col">
            <div className="dark:bg-polar-900 relative z-10 flex flex-row items-center justify-between space-x-2 bg-white px-4 pt-5 sm:px-6 md:hidden md:px-8">
              {header}
            </div>
            <div className="flex h-full flex-col overflow-y-auto pt-8">
              <DashboardSidebar />
            </div>
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

export const DashboardHeader = (props: { children?: React.ReactNode }) => {
  return (
    <div className={twMerge('sticky left-[300px] right-0 top-20 z-10')}>
      {props.children}
    </div>
  )
}

export const DashboardBody = (props: {
  children?: React.ReactNode
  className?: string
}) => {
  return (
    <div
      className={twMerge(
        'relative mx-auto mt-8 max-w-screen-xl px-4 pb-6 sm:px-6 md:px-8',
        props.className,
      )}
    >
      {props.children}
    </div>
  )
}
