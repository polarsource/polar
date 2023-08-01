import RepoSelection from '@/components/Dashboard/RepoSelection'
import { useRequireAuth } from '@/hooks'
import { EyeIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useListOrganizations, useListRepositories } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import { useMemo } from 'react'
import Topbar from './Topbar'
import TopbarPill from './TopbarPill'

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
  const listOrganizationQuery = useListOrganizations()
  const listRepositoriesQuery = useListRepositories()

  const publicPath = useMemo(() => {
    if (currentRepo && currentOrg) {
      return `/${currentOrg.name}/${currentRepo.name}`
    }
    if (currentOrg) {
      return `/${currentOrg.name}`
    }
    return undefined
  }, [currentOrg, currentRepo])

  if (
    !currentOrg ||
    !currentUser ||
    !listOrganizationQuery.data ||
    !listRepositoriesQuery.data
  ) {
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
        organizations={listOrganizationQuery.data?.items || []}
        repositories={listRepositoriesQuery.data?.items || []}
      />
      {publicPath && <PublicPageLink path={publicPath} />}
    </>
  )
}

const PersonalDashboardNav = () => {
  const router = useRouter()

  const { currentUser } = useRequireAuth()

  const listOrganizationQuery = useListOrganizations()
  const listRepositoriesQuery = useListRepositories()

  if (
    !currentUser ||
    !listOrganizationQuery.data ||
    !listRepositoriesQuery.data
  ) {
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
        organizations={listOrganizationQuery.data?.items || []}
        repositories={listRepositoriesQuery.data?.items || []}
      />
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
