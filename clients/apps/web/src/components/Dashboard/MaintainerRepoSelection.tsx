import { Repository } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import RepoSelection from '../Organization/RepoSelection'

const MaintainerRepoSelection = (props: {
  current?: Repository
  repositories: Repository[]
}) => {
  const router = useRouter()

  if (!props.repositories) {
    return <></>
  }

  return (
    <div className="relative flex w-fit shrink-0">
      <RepoSelection
        selectedClassNames="px-4"
        openClassNames="left-0 top-2"
        repositories={props.repositories}
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
        value={props.current}
      />
    </div>
  )
}

export default MaintainerRepoSelection
