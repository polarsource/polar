import RepoSelection from '@/components/Dashboard/RepoSelection'
import { useCurrentOrgAndRepoFromURL, useRequireAuth } from '@/hooks'
import { useRouter } from 'next/router'
import { useListOrganizations, useListRepositories } from 'polarkit/hooks'
import Topbar from './Topbar'

export const path = (
  currentPathname: string,
  org: string,
  repo?: string,
): string => {
  const withRepoRoutes: Record<string, string> = {
    '/maintainer/[organization]/issues':
      '/maintainer/[organization]/issues?repo=[repo]',
    '/dependencies/[organization]': '/dependencies/[organization]/[repo]',
  }

  const removeRepoRoutes: Record<string, string> = {
    '/maintainer/[organization]/issues?repo=[repo]':
      '/maintainer/[organization]/issues',
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
  // Fallback to navigate to /maintainer/ORG/issues
  // For example if the user is on "/maintainer/ORG/finance" and selects a repository, this routes to "/maintainer/ORG/issues?repo=REPO".
  if (
    !nextPathName.includes('[organization]') ||
    (!nextPathName.includes('[repo]') && repo)
  ) {
    if (repo) {
      return `/maintainer/${org}/issues?repo=${repo}`
    } else {
      return `/maintainer/${org}/issues`
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

  const { org: currentOrg, repo: currentRepo } = useCurrentOrgAndRepoFromURL()

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
        onSelectUser={() => router.push('/feed')}
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
