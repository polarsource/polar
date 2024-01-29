'use client'

import { Organization, Repository } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import RepoSelection from './RepoSelection'

const Navigation = ({
  organization,
  repositories,
  repository,
}: {
  organization: Organization
  repositories: Repository[]
  repository?: Repository
}) => {
  const router = useRouter()

  return (
    <div className="dark:text-polar-200 relative flex items-center text-gray-900">
      <img src={organization.avatar_url} className="h-8 w-8 rounded-full" />
      <div className="ml-4 text-sm ">{organization.name}</div>
      <div className="ml-3 mr-1">/</div>
      <RepoSelection
        selectedClassNames="rounded-lg ml-1"
        openClassNames="top-0"
        repositories={repositories}
        value={repository}
        onSelectRepo={(repo) => {
          router.push(`/${organization.name}/${repo}`)
        }}
        onSelectAll={() => {
          router.push(`/${organization.name}/issues`)
        }}
      />
    </div>
  )
}

export default Navigation
