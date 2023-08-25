import { useRouter } from 'next/router'
import { Repository } from 'polarkit/api/client'
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
    <div className="relative flex h-14 w-full shrink-0 lg:w-fit lg:border-r">
      <RepoSelection
        selectedClassNames="pl-2"
        openClassNames="left-2 top-2"
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
