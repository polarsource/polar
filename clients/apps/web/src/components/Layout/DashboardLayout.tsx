'use client'

import { useAuth } from '@/hooks/auth'
import Link from 'next/link'
import { CONFIG } from 'polarkit'
import { Repository } from 'polarkit/api/client'
import { LogoType } from 'polarkit/components/brand'
import { useListOrganizations } from 'polarkit/hooks'
import { classNames } from 'polarkit/utils'
import { Suspense } from 'react'
import SidebarNavigation from '../Dashboard/MaintainerNavigation'
import MaintainerRepoSelection from '../Dashboard/MaintainerRepoSelection'
import Popover from '../Notifications/Popover'
import DashboardTopbar from '../Shared/DashboardTopbar'
import ProfileSelection from '../Shared/ProfileSelection'

const DashboardLayout = (props: {
  children: React.ReactNode
  header?: React.ReactNode
}) => {
  const { currentUser, hydrated } = useAuth()

  const listOrganizationQuery = useListOrganizations()

  const orgs = listOrganizationQuery?.data?.items
  const showConnectUsell = orgs && orgs.length === 0

  if (!hydrated) {
    return <></>
  }

  return (
    <div className="relative flex w-full flex-row">
      <aside className="flex h-screen w-[320px] flex-shrink-0 flex-col justify-between border-r border-r-gray-200 bg-white dark:border-r-gray-800 dark:bg-gray-900">
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
        </div>

        {showConnectUsell && (
          <div className="mx-4 my-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
            <p className="mb-2">Get funding for your public repositories.</p>
            <Link
              href={CONFIG.GITHUB_INSTALLATION_URL}
              className="font-medium text-blue-600 dark:text-blue-500"
            >
              Connect repositories
            </Link>
          </div>
        )}
      </aside>
      <div className="relative flex h-screen w-full translate-x-0 flex-row bg-white dark:bg-gray-950">
        <DashboardTopbar isFixed={true} useOrgFromURL={true} />
        <main className={classNames('relative h-full w-full overflow-y-auto')}>
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
        className="flex flex-col justify-between space-y-2 border-b border-gray-200 bg-gray-100/50 bg-white p-2 !pr-2 backdrop-blur-none dark:border-gray-800 dark:bg-gray-800/50 lg:flex-row lg:items-center lg:space-x-4 lg:space-y-0 lg:bg-transparent lg:p-0 lg:backdrop-blur"
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
    <div className={classNames('sticky left-[300px] right-0 top-20 z-10')}>
      {props.children}
    </div>
  )
}

export const DashboardBody = (props: { children?: React.ReactNode }) => {
  return (
    <div
      className={classNames(
        'relative mx-auto max-w-screen-2xl px-4 pb-6 pt-28 sm:px-6 md:px-8',
      )}
    >
      {props.children}
    </div>
  )
}
