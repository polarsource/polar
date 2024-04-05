import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragIndicatorOutlined, GitHub } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { organizationPageLink } from 'polarkit/utils/nav'
import { twMerge } from 'tailwind-merge'

export const CreatorCard = ({
  className,
  organization,
  disabled,
  sortable,
}: {
  className?: string
  organization: Organization
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
        'dark:text-polar-500 dark:hover:text-polar-300 transition-color dark:hover:bg-polar-800 flex flex-col rounded-3xl text-gray-500 hover:bg-gray-50 hover:text-gray-600',
        sortable?.isDragging && 'opacity-30',
        className,
      )}
    >
      <Link className="h-full" href={organizationPageLink(organization)}>
        <CardHeader className="relative flex flex-row items-center gap-x-4 space-y-0 p-6">
          <Avatar
            className="h-10 w-10"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
          <div className="flex flex-col">
            <h3 className="dark:text-polar-50 text-gray-950">
              {organization.pretty_name || organization.name}
            </h3>
            {organization.pretty_name && (
              <h3 className="text-sm text-blue-500 dark:text-blue-400">
                @{organization.name}
              </h3>
            )}
          </div>
          {!disabled && (
            <span
              ref={
                disabled || !sortable ? undefined : sortable.setDraggableNodeRef
              }
              className="absolute right-6 top-6 cursor-grab"
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
          {organization.bio && (
            <p className="text-sm leading-relaxed [text-wrap:pretty]">
              {organization.bio}
            </p>
          )}
        </CardContent>
      </Link>
      <CardFooter className="flex flex-row items-center justify-between gap-x-4 p-6">
        <div className="flex w-full flex-row items-center gap-x-4">
          <Link href={organizationPageLink(organization, 'subscriptions')}>
            <Button size="sm">Subscribe</Button>
          </Link>
          <Link
            href={`https://github.com/${organization.name}`}
            target="_blank"
          >
            <Button size="icon" variant="secondary">
              <GitHub fontSize="inherit" />
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}

export const DraggableCreatorCard = ({
  className,
  organization,
  disabled,
}: {
  className?: string
  organization: Organization
  disabled?: boolean
}) => {
  const sortable = useSortable({ id: organization.id })

  return (
    <CreatorCard
      className={className}
      organization={organization}
      disabled={disabled}
      sortable={sortable}
    />
  )
}
