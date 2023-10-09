'use client'

import { useAuth } from '@/hooks/auth'
import { Repository } from 'polarkit/api/client'
import { LogoType } from 'polarkit/components/brand'
import { classNames } from 'polarkit/utils'
import { Suspense } from 'react'
import SidebarNavigation from '../Dashboard/MaintainerNavigation'
import MaintainerRepoSelection from '../Dashboard/MaintainerRepoSelection'
import ProfileSelection from '../Shared/ProfileSelection'
import Topbar from '../Shared/Topbar'

const DashboardLayout = (props: {
  children: React.ReactNode
  header?: React.ReactNode
}) => {
  const { currentUser, hydrated } = useAuth()

  if (!hydrated) {
    return <></>
  }

  return (
    <div className="relative flex w-full flex-row">
      <aside className="h-screen w-[320px] flex-shrink-0 border-r border-r-gray-100 bg-white dark:border-r-gray-800 dark:bg-gray-900">
        <a
          href="/"
          className="mt-10 flex-shrink-0 items-center space-x-2 px-9 font-semibold text-gray-700 md:inline-flex"
        >
          <LogoType />
        </a>
        <div className="mt-8 flex px-4 py-2">
          {currentUser && <ProfileSelection useOrgFromURL={true} />}
        </div>
        <SidebarNavigation />
      </aside>
      <div className="relative flex h-screen w-full translate-x-0 flex-row bg-gray-50 dark:bg-gray-950">
        <Topbar isFixed={true} useOrgFromURL={true} />
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
        className="flex flex-col justify-between space-y-2 border-b bg-gray-100/50 bg-white p-2 !pr-2 backdrop-blur-none dark:bg-gray-700/50 lg:flex-row lg:items-center lg:space-x-4 lg:space-y-0 lg:bg-transparent lg:p-0 lg:backdrop-blur"
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
    <div className={classNames('sticky left-[300px] right-0 top-24 z-10')}>
      {props.children}
    </div>
  )
}

export const DashboardBody = (props: { children?: React.ReactNode }) => {
  return (
    <div
      className={classNames(
        'relative mx-auto max-w-screen-2xl px-4 pb-6 pt-32 sm:px-6 md:px-8',
      )}
    >
      {props.children}
    </div>
  )
}
