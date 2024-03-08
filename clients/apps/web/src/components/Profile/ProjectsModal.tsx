import { StarIcon } from '@heroicons/react/20/solid'
import { HiveOutlined } from '@mui/icons-material'
import { Organization, Repository } from '@polar-sh/sdk'
import Button from 'polarkit/components/ui/atoms/button'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Separator } from 'polarkit/components/ui/separator'
import { formatStarsNumber } from 'polarkit/utils'

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
  const addRepository = (repository: Repository) => {
    setFeaturedProjects((repos) => [...repos, repository])
  }

  const removeRepository = (repository: Repository) => {
    setFeaturedProjects((repos) =>
      repos.filter((repo) => repo.id !== repository.id),
    )
  }

  return (
    <div className="flex flex-col gap-y-8 p-8">
      <div className="flex flex-col gap-y-2">
        <h3>Featured Projects</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Select which projects you'd like to highlight
        </p>
      </div>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex max-h-[300px] w-full flex-col overflow-y-auto">
          {repositories.map((repository) => (
            <ProjectRow
              key={repository.id}
              repository={repository}
              selected={featuredRepositories.includes(repository)}
              selectRepository={addRepository}
              deselectRepository={removeRepository}
            />
          ))}
        </div>
        <Separator className="dark:bg-polar-600" />
        <div className="flex flex-row items-center justify-end gap-x-2">
          <Button size="sm" variant="secondary" onClick={hideModal}>
            Close
          </Button>
        </div>
      </div>
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
