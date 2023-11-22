'use client'

import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useAuth } from '@/hooks/auth'
import { Repository } from '@polar-sh/sdk'
import Link from 'next/link'
import { CONFIG } from 'polarkit'
import { LogoIcon } from 'polarkit/components/brand'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { PropsWithChildren, Suspense } from 'react'
import { twMerge } from 'tailwind-merge'
import BackerNavigation from '../Dashboard/BackerNavigation'
import MaintainerNavigation from '../Dashboard/MaintainerNavigation'
import MaintainerRepoSelection from '../Dashboard/MaintainerRepoSelection'
import MetaNavigation from '../Dashboard/MetaNavigation'
import TeamsNavigation from '../Dashboard/TeamsNavigation'
import Popover from '../Notifications/Popover'
import ProfileSelection from '../Shared/ProfileSelection'

const DashboardLayout = (props: PropsWithChildren) => {
  const { currentUser, hydrated } = useAuth()
  const { org: currentOrg } = useCurrentOrgAndRepoFromURL()

  const listOrganizationQuery = useListAdminOrganizations()

  const orgs = listOrganizationQuery?.data?.items

  const shouldRenderBackerNavigation = currentOrg
    ? currentOrg.name === currentUser?.username
    : true

  const shouldRenderMaintainerNavigation = currentOrg
    ? true
    : orgs?.some((org) => org.name === currentUser?.username)

  const showConnectUpsell = orgs && orgs.length === 0

  if (!hydrated) {
    return <></>
  }

  return (
    <div className="relative flex w-full flex-row">
      <aside className="dark:bg-polar-900 dark:border-r-polar-800 flex h-screen w-[320px] flex-shrink-0 flex-col justify-between overflow-y-auto border-r border-r-gray-100 bg-white">
        <div className="flex flex-col gap-y-2">
          <div className="relative z-10 mt-5 flex translate-x-0 flex-row items-center justify-between space-x-2 pl-7 pr-8">
            <a
              href="/"
              className="flex-shrink-0 items-center font-semibold text-blue-500 dark:text-blue-400"
            >
              <LogoIcon className="h-10 w-10" />
            </a>

            <Suspense>{currentUser && <Popover type="dashboard" />}</Suspense>
          </div>
          <div className="mt-8 flex px-4">
            {currentUser && (
              <ProfileSelection useOrgFromURL={true} className="shadow-xl" />
            )}
          </div>

          {shouldRenderBackerNavigation && <BackerNavigation />}

          {shouldRenderMaintainerNavigation && (
            <>
              {shouldRenderBackerNavigation && (
                <div className="flex w-full flex-row items-center gap-x-2 px-7 pt-2">
                  <div
                    className="dark:text-polar-400 px-3 py-1 text-[10px] uppercase tracking-widest text-gray-500"
                    style={{ fontFeatureSettings: `"ss02" on` }}
                  >
                    Maintainer
                  </div>
                </div>
              )}
              <MaintainerNavigation />
            </>
          )}

          <TeamsNavigation />
        </div>

        <div className="flex flex-col gap-y-2">
          <MetaNavigation />

          {showConnectUpsell && (
            <div className="dark:bg-polar-800 dark:border-polar-700 dark:text-polar-400 mx-4 mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm">
              <p className="mb-2">Get funding for your public repositories.</p>
              <Link
                href={CONFIG.GITHUB_INSTALLATION_URL}
                className="font-medium text-blue-500"
              >
                Connect repositories
              </Link>
            </div>
          )}
        </div>
      </aside>
      <div className="dark:bg-polar-950 bg-gray-75 relative flex h-screen w-full translate-x-0 flex-row overflow-hidden">
        <main className={twMerge('relative mt-20 w-full overflow-auto')}>
          <Suspense>{props.children}</Suspense>
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout

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

export const DashboardBody = (props: { children?: React.ReactNode }) => {
  return (
    <div
      className={twMerge(
        'relative mx-auto mt-8 max-w-screen-xl px-4 pb-6 sm:px-6 md:px-8',
      )}
    >
      {props.children}
    </div>
  )
}
