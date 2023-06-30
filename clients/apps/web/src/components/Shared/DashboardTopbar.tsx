import RepoSelection from '@/components/Dashboard/RepoSelection'
import { useRequireAuth } from '@/hooks'
import {
  Cog8ToothIcon,
  CurrencyDollarIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Visibility } from 'polarkit/api/client'
import { useOrganizationAccounts, useUserOrganizations } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { useMemo } from 'react'
import Topbar from './Topbar'
import TopbarPill from './TopbarPill'

const SettingsLink = ({ orgSlug }: { orgSlug?: string }) => {
  let path = '/settings'
  if (orgSlug) {
    path += `/${orgSlug}`
  }

  return (
    <>
      <Link href={path}>
        <Cog8ToothIcon
          className="h-6 w-6 cursor-pointer text-gray-500 transition-colors duration-100 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          aria-hidden="true"
        />
      </Link>
    </>
  )
}

const MoneyLink = ({ orgSlug }: { orgSlug: string }) => {
  const accountQuery = useOrganizationAccounts(orgSlug)
  const accounts = accountQuery.data
  const currentOrg = useStore((state) => state.currentOrg)

  const hasPublicRepos =
    currentOrg &&
    currentOrg.repositories &&
    currentOrg.repositories.some((r) => r.visibility === Visibility.PUBLIC)

  const hasSetup = accounts?.some((a) => a.is_details_submitted && a.stripe_id)
  const showBadge = hasPublicRepos && !hasSetup && accountQuery.isFetched

  return (
    <>
      <div className="relative">
        <Link href={`/finance/${orgSlug}`}>
          <CurrencyDollarIcon
            className="h-6 w-6 cursor-pointer text-gray-500 transition-colors duration-100 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
            aria-hidden="true"
          />
          {showBadge && (
            <div className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></div>
          )}
        </Link>
      </div>
    </>
  )
}

const PublicPageLink = ({ path }: { path: string }) => {
  return (
    <>
      <Link href={path}>
        <TopbarPill color="gray" withIcon>
          <>
            <span>Public site</span>
            <EyeIcon className="h-6 w-6" />
          </>
        </TopbarPill>
      </Link>
    </>
  )
}

const DashboardNav = () => {
  const router = useRouter()
  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)

  const { currentUser } = useRequireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)

  const publicPath = useMemo(() => {
    if (currentRepo && currentOrg) {
      return `/${currentOrg.name}/${currentRepo.name}`
    }
    if (currentOrg) {
      return `/${currentOrg.name}`
    }
    return undefined
  }, [currentOrg, currentRepo])

  if (!currentOrg || !currentUser || !userOrgQuery.data) {
    return <></>
  }

  return (
    <>
      <RepoSelection
        showRepositories={true}
        showConnectMore={true}
        onSelectOrg={(org) => router.push(`/dashboard/${org}`)}
        onSelectRepo={(org, repo) => router.push(`/dashboard/${org}/${repo}`)}
        onSelectUser={() => router.push('/dashboard/personal')}
        currentOrg={currentOrg}
        currentRepo={currentRepo}
        showUserInDropdown={true}
        showOrganizationRepositoryCount={true}
        currentUser={currentUser}
        organizations={userOrgQuery.data}
      />
      {publicPath && <PublicPageLink path={publicPath} />}
      <SettingsLink orgSlug={currentOrg.name} />
      <MoneyLink orgSlug={currentOrg.name} />
    </>
  )
}

const PersonalDashboardNav = () => {
  const router = useRouter()

  const { currentUser } = useRequireAuth()
  const userOrgQuery = useUserOrganizations(currentUser)

  if (!currentUser || !userOrgQuery.data) {
    return <></>
  }

  return (
    <>
      <RepoSelection
        showRepositories={true}
        showConnectMore={true}
        onSelectOrg={(org) => router.push(`/dashboard/${org}`)}
        onSelectRepo={(org, repo) => router.push(`/dashboard/${org}/${repo}`)}
        onSelectUser={() => router.push('/dashboard/personal')}
        currentOrg={undefined}
        currentRepo={undefined}
        showUserInDropdown={true}
        defaultToUser={true}
        showOrganizationRepositoryCount={true}
        currentUser={currentUser}
        organizations={userOrgQuery.data}
      />
      <PublicPageLink path={`/${currentUser.username}`} />
      <SettingsLink orgSlug={'personal'} />
    </>
  )
}

const DashboardTopbar = () => {
  return (
    <>
      <Topbar isFixed={true}>
        {{
          left: <DashboardNav />,
        }}
      </Topbar>
    </>
  )
}

export const PersonalDashboardTopbar = () => {
  return (
    <Topbar isFixed={true}>
      {{
        left: <PersonalDashboardNav />,
      }}
    </Topbar>
  )
}

export default DashboardTopbar
