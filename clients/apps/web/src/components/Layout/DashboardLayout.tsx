'use client'

import {
  useCurrentOrgAndRepoFromURL,
  useGitHubAccount,
  useIsOrganizationAdmin,
  usePersonalOrganization,
} from '@/hooks'
import { useAuth } from '@/hooks/auth'
import { Repository, UserSignupType } from '@polar-sh/sdk'
import Link from 'next/link'
import { CONFIG } from 'polarkit'
import { LogoIcon } from 'polarkit/components/brand'
import { Button } from 'polarkit/components/ui/atoms'
import { useListAdminOrganizations } from 'polarkit/hooks'
import { PropsWithChildren, Suspense } from 'react'
import { twMerge } from 'tailwind-merge'
import BackerNavigation from '../Dashboard/BackerNavigation'
import DashboardNavigation from '../Dashboard/DashboardNavigation'
import MaintainerNavigation from '../Dashboard/MaintainerNavigation'
import MaintainerRepoSelection from '../Dashboard/MaintainerRepoSelection'
import MetaNavigation from '../Dashboard/MetaNavigation'
import Popover from '../Notifications/Popover'
import GithubLoginButton from '../Shared/GithubLoginButton'
import ProfileSelection from '../Shared/ProfileSelection'

const DashboardLayout = (props: PropsWithChildren) => {
  const { currentUser, hydrated } = useAuth()
  const { org: currentOrg } = useCurrentOrgAndRepoFromURL()
  const listOrganizationQuery = useListAdminOrganizations()
  const personalOrg = usePersonalOrganization()

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

  const shouldShowMaintainerUpsell = !currentOrg && !personalOrg

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
          <div className="mb-4 mt-8 flex px-4">
            {currentUser && (
              <ProfileSelection useOrgFromURL={true} className="shadow-xl" />
            )}
          </div>

          {shouldRenderBackerNavigation && <BackerNavigation />}

          {shouldRenderMaintainerNavigation && <MaintainerNavigation />}

          {shouldRenderDashboardNavigation && <DashboardNavigation />}

          <div className="flex flex-col pt-4">
            {shouldShowGitHubAuthUpsell ? (
              <GitHubAuthUpsell />
            ) : shouldShowMaintainerUpsell ? (
              <MaintainerUpsell />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-y-2">
          <MetaNavigation />
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

const GitHubAuthUpsell = () => {
  return (
    <Upsell
      title="Connect with GitHub"
      description="Unlock more features by connecting your account with GitHub"
    >
      <GithubLoginButton
        className="border-none bg-blue-500 text-white hover:bg-blue-400 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400 dark:hover:text-white"
        text="Connect with GitHub"
        gotoUrl={window.location.href}
        userSignupType={UserSignupType.BACKER}
      />
    </Upsell>
  )
}

const MaintainerUpsell = () => {
  return (
    <Upsell
      title="Become a maintainer"
      description="Supercharge your community with Posts & enable funding on your issues"
    >
      <Link
        href={CONFIG.GITHUB_INSTALLATION_URL}
        className="font-medium text-blue-500"
      >
        <Button className="-z-1" fullWidth>
          Connect Repositories
        </Button>
      </Link>
    </Upsell>
  )
}

const Upsell = ({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description: string }>) => {
  return (
    <div className="dark:bg-polar-800 dark:border-polar-700 dark:text-polar-400 mx-4 flex flex-col gap-y-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm">
      <h3 className="dark:text-polar-50 font-medium text-blue-500">{title}</h3>
      <p className="dark:text-polar-300 -mt-2 text-blue-400">{description}</p>
      {children}
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
