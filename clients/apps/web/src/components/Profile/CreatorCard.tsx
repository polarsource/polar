import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragIndicatorOutlined, GitHub } from '@mui/icons-material'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { useGetOrganization } from 'polarkit/hooks'
import { organizationPageLink } from 'polarkit/utils/nav'
import { twMerge } from 'tailwind-merge'

export const CreatorCard = ({
  organizationId,
  disabled,
  sortable,
}: {
  organizationId: string
  disabled?: boolean
  sortable?: ReturnType<typeof useSortable>
}) => {
  const organization = useGetOrganization(organizationId).data

  if (!organization) return null

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
        'dark:text-polar-500 dark:hover:text-polar-300 transition-color dark:hover:bg-polar-800 flex h-full flex-col gap-y-2 rounded-3xl text-gray-500 hover:bg-gray-50 hover:text-gray-600',
        sortable?.isDragging && 'opacity-30',
      )}
    >
      <Link className="h-full" href={organizationPageLink(organization)}>
        <CardHeader className="flex flex-row justify-between p-6">
          <Avatar
            className="h-16 w-16"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
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
        <CardContent className="flex h-full grow flex-col flex-wrap gap-y-4 px-6 py-0">
          <div className="flex flex-row items-baseline gap-x-3">
            <h3 className="dark:text-polar-50 text-lg text-gray-950">
              {organization.pretty_name || organization.name}
            </h3>
            {organization.pretty_name && (
              <h3 className="text-blue-500 dark:text-blue-400">
                @{organization.name}
              </h3>
            )}
          </div>
          {organization.bio && (
            <p className="[text-wrap:pretty]">{organization.bio}</p>
          )}
        </CardContent>
      </Link>
      <CardFooter className="flex flex-row items-center justify-between gap-x-4 p-6">
        <div className="flex w-full flex-row items-center justify-between gap-x-2">
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
  organizationId,
  disabled,
}: {
  organizationId: string
  disabled?: boolean
}) => {
  const sortable = useSortable({ id: organizationId })

  return (
    <CreatorCard
      organizationId={organizationId}
      disabled={disabled}
      sortable={sortable}
    />
  )
}
