import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useRouter } from 'next/router'
import { useListRepositories } from 'polarkit/hooks'
import RepoSelection from '../Organization/RepoSelection'

const MaintainerRepoSelection = () => {
  // Get current org & repo from URL
  const { org: currentOrg, repo: currentRepo } = useCurrentOrgAndRepoFromURL()
  const router = useRouter()

  // Get all repositories
  const listRepositoriesQuery = useListRepositories()
  const allRepositories = listRepositoriesQuery?.data?.items
  if (!currentOrg || !allRepositories) {
    return <></>
  }

  // Filter repos by current org & normalize for our select
  const allOrgRepositories = allRepositories.filter(
    (r) => r?.organization?.id === currentOrg.id,
  )

  return (
    <div className="relative flex w-full shrink-0 lg:w-fit lg:border-r">
      <RepoSelection
        selectedClassNames="pl-2"
        openClassNames="left-2 top-2"
        organization={currentOrg}
        repositories={allOrgRepositories}
        onSelectAll={() => {
          const currentURL = new URL(window.location.href)
          currentURL.searchParams.delete('repo')
          router.push(currentURL.toString())
        }}
        onSelectRepo={(repo) => {
          const currentURL = new URL(window.location.href)
          currentURL.searchParams.set('repo', repo)
          router.push(currentURL.toString())
        }}
        value={currentRepo}
      />
    </div>
  )
}

export default MaintainerRepoSelection
