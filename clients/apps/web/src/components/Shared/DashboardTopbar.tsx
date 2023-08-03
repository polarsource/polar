import RepoSelection from '@/components/Dashboard/RepoSelection'
import { useRequireAuth } from '@/hooks'
import { useRouter } from 'next/router'
import { useListOrganizations, useListRepositories } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import Topbar from './Topbar'

const DashboardNav = () => {
  const router = useRouter()
  const currentOrg = useStore((state) => state.currentOrg)
  const currentRepo = useStore((state) => state.currentRepo)

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
        currentOrg={currentOrg}
        currentRepo={currentRepo}
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

export default DashboardTopbar
