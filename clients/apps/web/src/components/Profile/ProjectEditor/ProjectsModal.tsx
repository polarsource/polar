import { SpinnerNoMargin } from '@/components/Shared/Spinner'
import { StarIcon } from '@heroicons/react/20/solid'
import { CloseOutlined, HiveOutlined } from '@mui/icons-material'
import { Organization, Platforms, Repository } from '@polar-sh/sdk'
import { api } from 'polarkit'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Banner } from 'polarkit/components/ui/molecules'
import { formatStarsNumber } from 'polarkit/utils'
import { useState } from 'react'

export interface ProfileModalProps {
  repositories: Repository[]
  featuredRepositories: Repository[]
  setFeaturedProjects: (producer: (repos: Repository[]) => Repository[]) => void
  organization: Organization
  hideModal: () => void
}

export const ProjectsModal = ({
  repositories,
  featuredRepositories,
  setFeaturedProjects,
  organization,
  hideModal,
}: ProfileModalProps) => {
  const [orgAndRepo, setOrgAndRepo] = useState('')
  const [showOrgNotFound, toggleOrgNotFound] = useState(false)
  const [repositoryRequestLoading, setRepositoryRequestLoading] =
    useState(false)

  const handleAddRepository = () => {
    toggleOrgNotFound(false)
    setRepositoryRequestLoading(true)

    const [organizationName, repositoryName] = orgAndRepo.split('/')

    api.repositories
      .lookup({
        organizationName,
        repositoryName,
        platform: Platforms.GITHUB,
      })
      .then(addRepository)
      .catch(() => toggleOrgNotFound(true))
      .finally(() => setRepositoryRequestLoading(false))
  }

  const addRepository = (repository: Repository) => {
    setFeaturedProjects((repos) => [...repos, repository])
  }

  const removeRepository = (repository: Repository) => {
    setFeaturedProjects((repos) =>
      repos.filter((repo) => repo.id !== repository.id),
    )
  }

  const extraRepositories = featuredRepositories.filter(
    (repo) => !repositories.some((r) => r.id === repo.id),
  )

  return (
    <div className="flex flex-col gap-y-8 p-10">
      <div className="absolute right-6 top-6">
        <Button
          className="focus-visible:ring-0"
          onClick={hideModal}
          size="icon"
          variant="ghost"
        >
          <CloseOutlined
            className="dark:text-polar-200 text-gray-700"
            fontSize="small"
          />
        </Button>
      </div>
      <div className="flex flex-col gap-y-2">
        <h3>Featured Projects</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Select which projects you&apos;d like to highlight. The project must
          belong to an organization that exists on the Polar platform.
        </p>
      </div>
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-row items-center gap-x-4">
          <Input
            value={orgAndRepo}
            onChange={(e) => setOrgAndRepo(e.target.value)}
            placeholder="organization/repository"
            postSlot={
              repositoryRequestLoading && (
                <SpinnerNoMargin className="h-4 w-4" />
              )
            }
          />
          <Button onClick={handleAddRepository}>Add</Button>
        </div>
        {showOrgNotFound && <Banner color="red">Repository not found</Banner>}
      </div>
      {extraRepositories.length > 0 && (
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col">
            {extraRepositories.map((repository) => (
              <SearchedProjectRow
                key={repository.id}
                repository={repository}
                onRemove={removeRepository}
              />
            ))}
          </div>
        </div>
      )}
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex max-h-[320px] w-full flex-col overflow-y-auto">
          {repositories.map((repository) => (
            <ProjectRow
              key={repository.id}
              repository={repository}
              selected={featuredRepositories.some(
                (repo) => repo.id === repository.id,
              )}
              selectRepository={addRepository}
              deselectRepository={removeRepository}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const SearchedProjectRow = ({
  repository,
  onRemove,
}: {
  repository: Repository
  onRemove: (repository: Repository) => void
}) => {
  return (
    <div className="dark:hover:bg-polar-700 dark:text-polar-50 flex flex-row items-center justify-between gap-x-2 rounded-lg px-4 py-3 text-sm text-gray-950 hover:bg-gray-100">
      <div className="flex flex-row items-center gap-x-2">
        <HiveOutlined
          className="text-blue-500 dark:text-blue-400"
          fontSize="small"
        />
        <span>
          {repository.organization.name}/{repository.name}
        </span>
      </div>
      <Button
        className="h-6 w-6"
        onClick={(e) => onRemove(repository)}
        variant="secondary"
        size="icon"
      >
        <CloseOutlined fontSize="inherit" />
      </Button>
    </div>
  )
}

const ProjectRow = ({
  repository,
  selected,
  selectRepository,
  deselectRepository,
}: {
  repository: Repository
  selected: boolean
  selectRepository: (repository: Repository) => void
  deselectRepository: (repository: Repository) => void
}) => {
  return (
    <div className="dark:hover:bg-polar-700 dark:text-polar-50 flex flex-row items-center justify-between gap-x-2 rounded-lg px-4 py-3 text-sm text-gray-950 hover:bg-gray-100">
      <div className="flex flex-row items-center gap-x-2">
        <HiveOutlined
          className="text-blue-500 dark:text-blue-400"
          fontSize="small"
        />
        <span>{repository.name}</span>
      </div>
      <div className="flex flex-row items-center gap-x-4">
        <span className="dark:text-polar-500 flex flex-row items-center gap-x-1.5 text-sm text-gray-500">
          <StarIcon className="h-4 w-4" />
          <span className="pt-.5">
            {formatStarsNumber(repository.stars ?? 0)}
          </span>
        </span>
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => {
            if (Boolean(v)) {
              selectRepository(repository)
            } else {
              deselectRepository(repository)
            }
          }}
        />
      </div>
    </div>
  )
}
