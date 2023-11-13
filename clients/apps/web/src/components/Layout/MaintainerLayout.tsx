'use client'

import { useAuth } from '@/hooks/auth'
import { Repository } from '@polar-sh/sdk'
import { LogoType } from 'polarkit/components/brand'
import { Suspense } from 'react'
import { twMerge } from 'tailwind-merge'
import SidebarNavigation from '../Dashboard/MaintainerNavigation'
import MaintainerRepoSelection from '../Dashboard/MaintainerRepoSelection'
import MetaNavigation from '../Dashboard/MetaNavigation'
import TeamsNavigation from '../Dashboard/TeamsNavigation'
import Popover from '../Notifications/Popover'
import ProfileSelection from '../Shared/ProfileSelection'

const MaintainerLayout = (props: { children: React.ReactNode }) => {
  const { currentUser, hydrated } = useAuth()

  if (!hydrated) {
    return <></>
  }

  return (
    <div className="relative flex w-full flex-row">
      <aside className="dark:bg-polar-950 dark:border-r-polar-700 flex h-screen w-[320px] flex-shrink-0 flex-col justify-between overflow-hidden border-r border-r-gray-100 bg-white">
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
        </div>
      </aside>
      <div className="dark:bg-polar-950 relative flex h-screen w-full translate-x-0 flex-row overflow-hidden bg-gray-50">
        <main className={twMerge('relative h-full w-full overflow-auto')}>
          <Suspense>{props.children}</Suspense>
        </main>
      </div>
    </div>
  )
}

export default MaintainerLayout

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
        'relative mx-auto max-w-screen-2xl px-4 pb-6 pt-28 sm:px-6 md:px-8',
      )}
    >
      {props.children}
    </div>
  )
}
