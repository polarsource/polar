import { useCurrentOrgAndRepoFromURL } from '@/hooks'
import { useRouter } from 'next/router'
import { useListRepositories } from 'polarkit/hooks'

const RepoSelection = (props: {}) => {
  // Get current org & repo from URL
  const { org: currentOrg, repo: currentRepo } = useCurrentOrgAndRepoFromURL()
  const router = useRouter()

  const currentFilter = currentRepo?.name || 'All repositories'

  // Get all repositories
  const listRepositoriesQuery = useListRepositories()
  const allRepositories = listRepositoriesQuery?.data?.items
  if (!currentOrg || !allRepositories) {
    return <></>
  }

  // Filter repos by current org & normalize for our select
  const filterRepos = allRepositories.reduce(
    (filtered, repo) => {
      if (repo?.organization?.id === currentOrg.id) {
        filtered.push(repo.name)
      }
      return filtered
    },
    ['All repositories'],
  )

  const onRepoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chosen = e.target.value
    if (chosen === currentFilter) {
      return
    }

    const currentURL = new URL(window.location.href)
    if (chosen === 'All repositories') {
      currentURL.searchParams.delete('repo')
    } else {
      currentURL.searchParams.set('repo', chosen)
    }

    router.push(currentURL.toString())
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <RepoIcon />
      <select
        id="sort-by"
        className="m-0 w-48 border-0 bg-transparent bg-right p-0 text-sm font-medium ring-0 focus:border-0 focus:ring-0"
        value={currentFilter}
        onChange={onRepoChange}
      >
        {filterRepos.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </div>
  )
}

const RepoIcon = () => {
  return (
    <svg
      width="17"
      height="18"
      viewBox="0 0 17 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.75 14.5208C2.75 14.0512 2.93931 13.6008 3.27629 13.2687C3.61327 12.9366 4.07031 12.75 4.54688 12.75H14.25"
        stroke="#727374"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.54688 1.75H14.25V16.25H4.54688C4.07031 16.25 3.61327 16.059 3.27629 15.7191C2.93931 15.3792 2.75 14.9182 2.75 14.4375V3.5625C2.75 3.0818 2.93931 2.62078 3.27629 2.28087C3.61327 1.94096 4.07031 1.75 4.54688 1.75Z"
        stroke="#727374"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
export default RepoSelection
