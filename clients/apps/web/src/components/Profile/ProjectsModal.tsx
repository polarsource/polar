import { StarIcon } from '@heroicons/react/20/solid'
import { HiveOutlined } from '@mui/icons-material'
import { Organization, Platforms, Repository } from '@polar-sh/sdk'
import { api } from 'polarkit'
import Button from 'polarkit/components/ui/atoms/button'
import Input from 'polarkit/components/ui/atoms/input'
import { Checkbox } from 'polarkit/components/ui/checkbox'
import { Separator } from 'polarkit/components/ui/separator'
import { formatStarsNumber } from 'polarkit/utils'
import { useCallback, useState } from 'react'

export interface ProfileEditorProps {
  repositories: Repository[]
  selectedRepositories: Repository[]
  organization: Organization
  hideModal: () => void
  setRepositories: (repositories: Repository[]) => void
}

export const ProjectsModal = ({
  repositories,
  organization,
  selectedRepositories,
  hideModal,
  setRepositories,
}: ProfileEditorProps) => {
  const [orgAndRepo, setOrgAndRepo] = useState('')

  const uniqueRepos = new Map([
    ...selectedRepositories.map((repo) => [repo.id, repo] as const),
    ...repositories.map((repo) => [repo.id, repo] as const),
  ])

  const addRepository = useCallback(
    async (namespaceAndRepo: string) => {
      const [orgName, repo] = namespaceAndRepo.split('/')

      const repository = await api.repositories.lookup({
        organizationName: orgName,
        repositoryName: repo,
        platform: Platforms.GITHUB,
      })

      if (repository) {
        setRepositories([repository, ...selectedRepositories])
      }
    },
    [selectedRepositories, setRepositories],
  )

  return (
    <div className="flex flex-col gap-y-8 p-8">
      <div className="flex flex-col gap-y-2">
        <h3>Featured Projects</h3>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          Select which projects you'd like to highlight
        </p>
      </div>
      <div className="flex flex-row items-center gap-x-4">
        <Input
          value={orgAndRepo}
          onChange={(e) => setOrgAndRepo(e.target.value)}
          placeholder="organization/repo"
        />
        <Button onClick={(e) => addRepository(orgAndRepo)}>Add</Button>
      </div>
      <div className="flex w-full flex-col gap-y-8">
        <div className="flex max-h-[300px] w-full flex-col overflow-y-auto">
          {[...uniqueRepos.values()].map((repository) => (
            <div
              key={repository.id}
              className="dark:hover:bg-polar-700 dark:text-polar-50 flex flex-row items-center justify-between gap-x-2 rounded-lg px-4 py-3 text-sm text-gray-950 hover:bg-gray-100"
            >
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
                  checked={selectedRepositories.some(
                    (repo) => repo.id === repository.id,
                  )}
                  onCheckedChange={(v) => {
                    if (Boolean(v)) {
                      setRepositories([...selectedRepositories, repository])
                    } else {
                      setRepositories(
                        selectedRepositories.filter(
                          (repo) => repo.id !== repository.id,
                        ),
                      )
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <Separator className="dark:bg-polar-600" />
        <div className="flex flex-row items-center justify-end gap-x-2">
          <Button onClick={hideModal}>Save</Button>
        </div>
      </div>
    </div>
  )
}
