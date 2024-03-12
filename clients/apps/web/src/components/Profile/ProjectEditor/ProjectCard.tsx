import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { StarIcon } from '@heroicons/react/20/solid'
import { StarIcon as StarIconOutlined } from '@heroicons/react/24/outline'
import { DragIndicatorOutlined, HiveOutlined } from '@mui/icons-material'
import { Repository } from '@polar-sh/sdk'
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
import { twMerge } from 'tailwind-merge'

export const ProjectCard = ({
  repository,
  disabled,
  sortable,
}: {
  repository: Repository
  disabled?: boolean
  sortable?: ReturnType<typeof useSortable>
}) => {
  return (
    <Card
      ref={sortable ? sortable.setNodeRef : undefined}
      style={
        sortable
          ? {
              transform: CSS.Transform.toString(sortable.transform),
              transition: sortable.transition,
            }
          : {}
      }
      className={twMerge(
        'dark:text-polar-500 transition-color dark:hover:text-polar-300 dark:hover:bg-polar-800 transition-color flex flex-col gap-y-2 rounded-3xl text-gray-500 hover:bg-gray-50 hover:text-gray-600',
        sortable?.isDragging && 'opacity-30',
      )}
    >
      <Link
        className="h-full"
        href={organizationPageLink(repository.organization, repository.name)}
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
            <span
              ref={
                disabled || !sortable ? undefined : sortable.setDraggableNodeRef
              }
              className="cursor-grab"
              {...sortable?.attributes}
              {...sortable?.listeners}
            >
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
      </Link>
      <CardFooter className="flex flex-row flex-wrap items-center justify-between gap-4 p-6">
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
        >
          <Button className="rounded-lg px-2.5" variant="secondary" size="sm">
            <StarIconOutlined className="mr-2 h-4 w-4" />
            <span>Star on GitHub</span>
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

export const DraggableProjectCard = ({
  repository,
  disabled,
}: {
  repository: Repository
  disabled?: boolean
}) => {
  const sortable = useSortable({ id: repository.id })

  return (
    <ProjectCard
      sortable={sortable}
      repository={repository}
      disabled={disabled}
    />
  )
}
