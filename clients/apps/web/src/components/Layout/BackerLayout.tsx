'use client'

import ProfileSelection from '@/components/Shared/ProfileSelection'
import { useAuth } from '@/hooks/auth'
import Link from 'next/link'
import { CONFIG } from 'polarkit'
import { LogoType } from 'polarkit/components/brand'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { Suspense } from 'react'
import { twMerge } from 'tailwind-merge'
import SidebarNavigation from '../Dashboard/BackerNavigation'
import MetaNavigation from '../Dashboard/MetaNavigation'
import TeamsNavigation from '../Dashboard/TeamsNavigation'
import Popover from '../Notifications/Popover'
import DashboardTopbar from '../Shared/DashboardTopbar'

const BackerLayout = (props: {
  children: React.ReactNode
  disableOnboardingBanner?: boolean
}) => {
  const { currentUser, hydrated } = useAuth()
  const isBackerConnectUpsellSkipped = useStore(
    (store) => store.onboardingMaintainerConnectRepositoriesSkip,
  )

  const showBanner =
    !isBackerConnectUpsellSkipped && !props.disableOnboardingBanner

  const listOrganizationQuery = useListAdminOrganizations()

  const orgs = listOrganizationQuery?.data?.items

  const showConnectUpsell = orgs && orgs.length === 0

  if (!hydrated) {
    return <></>
  }

  return (
    <div className="relative flex w-full flex-row">
      <aside className="dark:bg-polar-900 dark:border-r-polar-800 flex h-screen w-[320px] flex-shrink-0 flex-col justify-between border-r border-r-gray-100 bg-white">
        <div className="flex flex-col">
          <div className="relative z-10 mt-7 flex translate-x-0 flex-row items-center justify-between space-x-2 pl-9 pr-7">
            <a
              href="/"
              className="flex-shrink-0 items-center font-semibold text-gray-700"
            >
              <LogoType />
            </a>

            <Suspense>{currentUser && <Popover type="dashboard" />}</Suspense>
          </div>
          <div className="mt-8 flex px-4 py-2">
            {currentUser && (
              <ProfileSelection
                useOrgFromURL={true}
                className="shadow-xl"
                narrow={false}
              />
            )}
          </div>
          <SidebarNavigation />
          <TeamsNavigation />
        </div>

        <div className="flex flex-col gap-y-2">
          <MetaNavigation />

          {showConnectUpsell ? (
            <div className="dark:bg-polar-800 dark:border-polar-700 dark:text-polar-400 mx-4 mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm">
              <p className="mb-2">Get funding for your public repositories.</p>
              <Link
                href={CONFIG.GITHUB_INSTALLATION_URL}
                className="font-medium text-blue-500"
              >
                Connect repositories
              </Link>
            </div>
          ) : (
            <div className="dark:bg-polar-800 dark:border-polar-700 dark:text-polar-400 mx-4 mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm">
              <p className="mb-2">Waiting for a bug to be fixed?</p>
              <Link
                href="/new"
                className="font-medium text-blue-500 dark:text-blue-400"
              >
                Fund a GitHub issue
              </Link>
            </div>
          )}
        </div>
      </aside>

      <div className="dark:bg-polar-950 relative flex h-screen w-full translate-x-0 flex-row bg-gray-50">
        <DashboardTopbar isFixed useOrgFromURL />

        <main className={twMerge('relative h-full w-full overflow-y-auto')}>
          <div
            className={twMerge(
              'relative mx-auto max-w-screen-xl px-4 sm:px-6 md:px-8',
            )}
            style={{
              marginTop: `107px`,
            }}
          >
            {props.children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default BackerLayout
