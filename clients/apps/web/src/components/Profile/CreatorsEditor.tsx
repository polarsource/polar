import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DragIndicatorOutlined } from '@mui/icons-material'
import { Organization, OrganizationProfileSettings } from '@polar-sh/sdk'
import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { useGetOrganization, useUpdateOrganization } from 'polarkit/hooks'
import { organizationPageLink } from 'polarkit/utils/nav'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { CreatorsModal } from './CreatorsModal'

const CreatorCard = ({
  organizationId,
  disabled,
}: {
  organizationId: string
  disabled?: boolean
}) => {
  const sortable = useSortable({ id: organizationId })
  const {
    attributes,
    listeners,
    isDragging,
    setNodeRef,
    setDraggableNodeRef,
    transform,
    transition,
  } = sortable

  const organization = useGetOrganization(organizationId).data

  if (!organization) return null

  return (
    <Card
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={twMerge(
        'dark:hover:bg-polar-800 dark:text-polar-500 dark:hover:text-polar-300 transition-color flex h-full flex-col gap-y-2 rounded-3xl text-gray-500 duration-100 hover:bg-gray-50 hover:text-gray-600',
      )}
      {...attributes}
      {...listeners}
    >
      <Link className="h-full" href={organizationPageLink(organization)}>
        <CardHeader className="flex flex-row justify-between p-6">
          <Avatar
            className="h-16 w-16"
            avatar_url={organization.avatar_url}
            name={organization.name}
          />
          {!disabled && (
            <span ref={setDraggableNodeRef} className="cursor-grab">
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
        <div className="flex-items flex items-center gap-x-2">
          <Link href={organizationPageLink(organization, 'subscriptions')}>
            <Button size="sm">Subscribe</Button>
          </Link>
          <Link
            href={`https://github.com/${organization.name}`}
            target="_blank"
          >
            <Button size="sm" variant="ghost">
              GitHub Profile
            </Button>
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}

export interface CreatorsEditorProps {
  organization: Organization
  profile: OrganizationProfileSettings
  disabled?: boolean
}

export const CreatorsEditor = ({
  organization,
  profile,
  disabled,
}: CreatorsEditorProps) => {
  const [featuredCreators, setFeaturedCreators] = useState(
    profile.featured_organizations.map((org) => ({ id: org })),
  )
  const [activeId, setActiveId] = useState<string | number | null>(null)
  const { show, isShown, hide } = useModal()
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor))
  const updateOrganizationMutation = useUpdateOrganization()

  const updateFeaturedCreators = (
    producer: (prev: { id: string }[]) => { id: string }[],
  ) => {
    const newCreators = producer(featuredCreators)

    setFeaturedCreators(newCreators)

    updateOrganizationMutation.mutateAsync({
      id: organization.id,
      settings: {
        profile_settings: {
          featured_organizations: newCreators.map((c) => c.id),
        },
      },
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    console.log(active, over)
    if (active.id !== over?.id) {
      updateFeaturedCreators((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }

    setActiveId(null)
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={featuredCreators} strategy={rectSortingStrategy}>
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-col gap-y-2 md:flex-row md:justify-between">
            <h3 className="text-lg">Featured Creators</h3>
            {!disabled && (
              <Button variant="ghost" onClick={show}>
                Configure Creators
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {featuredCreators.map((creator) => (
              <CreatorCard
                key={creator.id}
                organizationId={creator.id}
                disabled={disabled}
              />
            ))}
          </div>
          <DragOverlay adjustScale={true}>
            {activeId ? (
              <CreatorCard organizationId={activeId as string} />
            ) : null}
          </DragOverlay>
        </div>
        <Modal
          className="w-full md:max-w-lg lg:max-w-lg"
          isShown={isShown}
          hide={hide}
          modalContent={
            <CreatorsModal
              creators={profile.featured_organizations.map((id) => ({ id }))}
              organization={organization}
              setCreators={updateFeaturedCreators}
              hideModal={hide}
            />
          }
        />
      </SortableContext>
    </DndContext>
  )
}
