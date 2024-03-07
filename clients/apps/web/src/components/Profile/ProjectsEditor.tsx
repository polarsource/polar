import { StarIcon } from '@heroicons/react/20/solid'
import { StarIcon as StarIconOutlined } from '@heroicons/react/24/outline'
import {
  ArrowForwardOutlined,
  DragIndicatorOutlined,
  HiveOutlined,
} from '@mui/icons-material'
import { Organization, Repository } from '@polar-sh/sdk'
import Link from 'next/link'
import { Pill } from 'polarkit/components/ui/atoms'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { formatStarsNumber } from 'polarkit/utils'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { ProjectsModal } from './ProjectsModal'
import { DraggableProps, useDraggable } from './useDraggable'

const RepositoryCard = <T,>({
  id,
  repository,
  index,
  setItems,
  disabled,
}: DraggableProps<T> & { repository: Repository }) => {
  const { dragRef, previewRef, handlerId, isDragging } = useDraggable({
    id,
    index,
    setItems,
    disabled,
  })

  return (
    <Link
      href={organizationPageLink(repository.organization, repository.name)}
      data-handler-id={handlerId}
    >
      <Card
        ref={previewRef}
        className={twMerge(
          'dark:hover:bg-polar-800 dark:text-polar-500 dark:hover:text-polar-300 transition-color flex h-full flex-col rounded-3xl text-gray-500 duration-100 hover:bg-gray-50 hover:text-gray-600',
          isDragging && 'opacity-30',
        )}
      >
        <CardHeader className="flex flex-row justify-between p-6">
          <div className="flex flex-row items-baseline gap-x-3">
            <span className="text-[20px] text-blue-500">
              <HiveOutlined fontSize="inherit" />
            </span>
            <h3 className="dark:text-polar-50 text-lg text-gray-950">
              {repository.name}
            </h3>
          </div>
          {!disabled && (
            <span ref={dragRef} className="cursor-grab">
              <DragIndicatorOutlined
                className={twMerge('dark:text-polar-600 text-gray-400')}
                fontSize="small"
              />
            </span>
          )}
        </CardHeader>
        <CardContent className="flex h-full grow flex-col flex-wrap px-6 py-0">
          {repository.description && <p>{repository.description}</p>}
        </CardContent>
        <CardFooter className="flex flex-row items-center justify-between gap-x-4 p-6">
          <div className="flex-items flex items-center gap-x-4">
            {repository.license && (
              <Pill className="px-3 py-1.5" color="blue">
                {repository.license}
              </Pill>
            )}
            <span className="flex flex-row items-center gap-x-1 text-sm">
              <StarIcon className="h-4 w-4" />
              <span className="pt-.5">
                {formatStarsNumber(repository.stars ?? 0)}
              </span>
            </span>
          </div>
          <Link
            href={`https://github.com/${repository.organization.name}/${repository.name}`}
            target="_blank"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <Button className="rounded-lg px-2.5" variant="secondary" size="sm">
              <StarIconOutlined className="mr-2 h-4 w-4" />
              <span>Star on GitHub</span>
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </Link>
  )
}

export interface ProjectsEditorProps {
  organization: Organization
  repositories: Repository[]
  disabled?: boolean
}

export const ProjectsEditor = ({
  organization,
  repositories,
  disabled,
}: ProjectsEditorProps) => {
  const [selectedRepositories, setSelectedRepositories] = useState<
    Repository[]
  >(repositories.slice(0, 4))

  const { show, isShown, hide } = useModal()

  return (
    <>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-col gap-y-2 md:flex-row md:justify-between">
          <h3 className="text-lg">Featured Projects</h3>
          {disabled ? (
            <Link
              className="text-sm text-blue-500 dark:text-blue-400"
              href={organizationPageLink(organization, 'repositories')}
            >
              <span>View all projects</span>
              <ArrowForwardOutlined className="ml-2" fontSize="inherit" />
            </Link>
          ) : (
            <Button variant="ghost" onClick={show}>
              Configure Projects
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {selectedRepositories.map((repository, i) => (
            <RepositoryCard
              key={repository.id}
              index={i}
              id={repository.id}
              repository={repository}
              disabled={disabled}
              setItems={setSelectedRepositories}
            />
          ))}
        </div>
      </div>
      <Modal
        className="w-full md:max-w-lg lg:max-w-lg"
        isShown={isShown}
        hide={hide}
        modalContent={
          <ProjectsModal
            repositories={repositories}
            selectedRepositories={selectedRepositories}
            organization={organization}
            setRepositories={setSelectedRepositories}
            hideModal={hide}
          />
        }
      />
    </>
  )
}
