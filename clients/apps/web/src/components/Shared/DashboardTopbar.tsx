import RepoSelection from '@/components/Dashboard/RepoSelection'
import { useRequireAuth } from '@/hooks'
import { useRouter } from 'next/router'
import { useListOrganizations, useListRepositories } from 'polarkit/hooks'
import { useStore } from 'polarkit/store'
import Topbar from './Topbar'

export const path = (
  currentPathname: string,
  org: string,
  repo?: string,
): string => {
  const withRepoRoutes: Record<string, string> = {
    '/issues/[organization]': '/issues/[organization]/[repo]',
    '/dependencies/[organization]': '/dependencies/[organization]/[repo]',
  }

  const removeRepoRoutes: Record<string, string> = {
    '/issues/[organization]/[repo]': '/issues/[organization]',
    '/dependencies/[organization]/[repo]': '/dependencies/[organization]',
  }

  let nextPathName = currentPathname

  if (currentPathname.includes('[repo]') && !repo) {
    nextPathName = removeRepoRoutes[currentPathname] || currentPathname
  }
  if (!currentPathname.includes('[repo]') && repo) {
    nextPathName = withRepoRoutes[currentPathname] || currentPathname
  }

  // Currently on a path that does not have [organization] or [repo]
  // Fallback to navigate to /issues
  // For example if the user is on "/finance/ORG" and selects a repository, this routes to "/issues/ORG/REPO".
  if (
    !nextPathName.includes('[organization]') ||
    (!nextPathName.includes('[repo]') && repo)
  ) {
    if (repo) {
      return `/issues/${org}/${repo}`
    } else {
      return `/issues/${org}`
    }
  }

  let next = nextPathName.replace('[organization]', org)

  if (repo) {
    next = next.replace('[repo]', repo)
  }

  return next
}

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
        onSelectOrg={(org) => router.push(path(router.pathname, org))}
        onSelectRepo={(org, repo) =>
          router.push(path(router.pathname, org, repo))
        }
        onSelectUser={() => router.push('/dependencies/personal')}
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
