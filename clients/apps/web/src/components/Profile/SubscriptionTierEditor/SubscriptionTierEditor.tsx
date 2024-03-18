import revalidate from '@/app/actions'
import { Modal } from '@/components/Modal'
import { useModal } from '@/components/Modal/useModal'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { BoltOutlined } from '@mui/icons-material'
import { Organization, Repository, SubscriptionTier } from '@polar-sh/sdk'
import { ShadowBoxOnMd } from 'polarkit/components/ui/atoms/shadowbox'
import { useUpdateProject } from 'polarkit/hooks'
import { useDraggableEditorCallbacks } from '../Draggable/useDraggableEditorCallbacks'
import { DraggableSubscriptionTierCard } from './DraggableSubscriptionTierCard'
import { SubscriptionTiersModal } from './SubscriptionTierModal'

export interface SubscriptionTierEditorProps {
  organization: Organization
  repository: Repository
  subscriptionTiers: SubscriptionTier[]
  disabled?: boolean
}

export const SubscriptionTierEditor = ({
  organization,
  repository,
  subscriptionTiers,
  disabled,
}: SubscriptionTierEditorProps) => {
  const { show, isShown, hide } = useModal()

  const updateProjectMutation = useUpdateProject()

  const {
    items: highlightedTiers,
    sensors,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    updateItems,
  } = useDraggableEditorCallbacks(
    repository.profile_settings.highlighted_subscription_tiers
      ?.map((id) => subscriptionTiers.find((tier) => tier.id === id))
      .filter((tier): tier is SubscriptionTier => !!tier) ?? [],
    (tiers) =>
      updateProjectMutation
        .mutateAsync({
          id: repository.id,
          repositoryUpdate: {
            profile_settings: {
              highlighted_subscription_tiers: tiers.map((tier) => tier.id),
            },
          },
        })
        .then(() =>
          revalidate(`repository:${organization.name}/${repository.name}`),
        ),
  )

  if (disabled && highlightedTiers.length < 1) {
    return null
  }

  return (
    <ShadowBoxOnMd className="dark:md:bg-polar-900/50 flex w-full flex-col items-center gap-y-12 md:bg-blue-50/50 md:py-12">
      <div className="flex flex-col items-center gap-y-6">
        <div className="flex flex-col items-center gap-y-4">
          <BoltOutlined
            className="text-blue-500 dark:text-blue-400"
            fontSize="large"
          />
          <h2 className="text-xl">Subscriptions</h2>
          <p className="dark:text-polar-500 text-center text-gray-500 [text-wrap:balance]">
            Support {repository.name} with a subscription & receive unique
            benefits in return
          </p>
          {!disabled && (
            <p
              className="cursor-pointer text-center text-blue-500 dark:text-blue-400"
              onClick={show}
            >
              Configure
            </p>
          )}
        </div>
      </div>
      <div className="flex w-full flex-row flex-wrap items-center justify-center gap-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={highlightedTiers}
            strategy={rectSortingStrategy}
          >
            {highlightedTiers.map((tier) => (
              <DraggableSubscriptionTierCard
                key={tier.id}
                organization={organization}
                subscriptionTier={tier}
                subscribeButton={!!disabled}
                disabled={disabled}
              />
            ))}
            <DragOverlay adjustScale={true}>
              {activeId ? (
                <DraggableSubscriptionTierCard
                  className="h-full"
                  organization={organization}
                  subscribeButton={false}
                  subscriptionTier={
                    highlightedTiers.find(
                      (tier) => tier.id === activeId,
                    ) as SubscriptionTier
                  }
                />
              ) : null}
            </DragOverlay>
          </SortableContext>
        </DndContext>
      </div>

      <Modal
        className="w-full md:max-w-lg lg:max-w-lg"
        isShown={isShown}
        hide={hide}
        modalContent={
          <SubscriptionTiersModal
            selectedSubscriptionTiers={highlightedTiers}
            setSubscriptionTiers={updateItems}
            subscriptionTiers={subscriptionTiers}
            organization={organization}
            hideModal={hide}
          />
        }
      />
    </ShadowBoxOnMd>
  )
}
