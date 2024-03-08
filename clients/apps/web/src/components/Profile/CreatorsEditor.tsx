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
} from '@dnd-kit/sortable'
import { FaceOutlined, TuneOutlined } from '@mui/icons-material'
import { Organization } from '@polar-sh/sdk'
import { useUpdateOrganization } from 'polarkit/hooks'
import { useState } from 'react'
import { Modal } from '../Modal'
import { useModal } from '../Modal/useModal'
import { CreatorCard, DraggableCreatorCard } from './CreatorCard'
import { CreatorsModal } from './CreatorsModal'

export interface CreatorsEditorProps {
  organization: Organization
  featuredOrganizations: Organization[]
  disabled?: boolean
}

export const CreatorsEditor = ({
  organization,
  featuredOrganizations,
  disabled,
}: CreatorsEditorProps) => {
  const [featuredCreators, setFeaturedCreators] = useState(
    featuredOrganizations,
  )
  const [activeId, setActiveId] = useState<string | number | null>(null)
  const { show, isShown, hide } = useModal()
  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor))
  const updateOrganizationMutation = useUpdateOrganization()

  const updateFeaturedCreators = (
    producer: (prev: Organization[]) => Organization[],
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

  const EditorEmptyState = () => {
    return (
      <div className="flex flex-col gap-y-8">
        <div className="dark:border-polar-800 dark:bg-polar-900 flex flex-col items-center gap-y-4 rounded-3xl border-gray-100 bg-white py-16 shadow-sm">
          <FaceOutlined
            fontSize="large"
            className="text-blue-500 dark:text-blue-400"
          />
          <h3 className="text-center text-lg">Featured Developers</h3>
          <p
            className="cursor-pointer text-center text-blue-500 dark:text-blue-400"
            onClick={show}
          >
            Add featured developers to your profile
          </p>
        </div>
        <Modal
          className="w-full md:max-w-lg lg:max-w-lg"
          isShown={isShown}
          hide={hide}
          modalContent={
            <CreatorsModal
              creators={featuredCreators}
              organization={organization}
              setCreators={updateFeaturedCreators}
              hideModal={hide}
            />
          }
        />
      </div>
    )
  }

  if (featuredCreators.length === 0 && !disabled) {
    return <EditorEmptyState />
  }

  return featuredCreators.length > 0 ? (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={featuredCreators} strategy={rectSortingStrategy}>
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-col items-start gap-y-2 md:flex-row md:justify-between">
            <h3 className="text-lg">Featured Developers</h3>
            {!disabled && (
              <div
                className="flex cursor-pointer flex-row items-center gap-x-2 text-sm text-blue-500 dark:text-blue-400"
                onClick={show}
              >
                <TuneOutlined fontSize="small" />
                <span>Configure</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {featuredCreators.map((creator) => (
              <DraggableCreatorCard
                key={creator.id}
                organization={creator}
                disabled={disabled}
              />
            ))}
          </div>
          <DragOverlay adjustScale={true}>
            {activeId ? (
              <CreatorCard
                organization={
                  featuredCreators.find(
                    (c) => c.id === activeId,
                  ) as Organization
                }
              />
            ) : null}
          </DragOverlay>
        </div>
        <Modal
          className="w-full md:max-w-lg lg:max-w-lg"
          isShown={isShown}
          hide={hide}
          modalContent={
            <CreatorsModal
              creators={featuredCreators}
              organization={organization}
              setCreators={updateFeaturedCreators}
              hideModal={hide}
            />
          }
        />
      </SortableContext>
    </DndContext>
  ) : null
}
