'use client'

import { useModal } from '@/components/Modal/useModal'
import CancelSubscriptionModal from '@/components/Subscriptions/CancelSubscriptionModal'
import PauseSubscriptionModal from '@/components/Subscriptions/PauseSubscriptionModal'
import { toast } from '@/components/Toast/use-toast'
import { getPauseAction } from '@/utils/subscription'
import { MoreVertOutlined } from '@polar-sh/orbit/icons'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal } from '@polar-sh/orbit'
import { useSubscriptionActions } from './useSubscriptionActions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'

interface SubscriptionActionsMenuProps {
  subscription: schemas['Subscription']
}

const SubscriptionActionsMenu = ({
  subscription,
}: SubscriptionActionsMenuProps) => {
  const cancellationModal = useModal()
  const pauseModal = useModal()

  const pauseAction = getPauseAction(subscription)

  const actions = useSubscriptionActions(subscription.id)

  const handleCopyId = () => {
    navigator.clipboard
      .writeText(subscription.id)
      .then(() =>
        toast({
          title: 'Subscription ID copied',
          description: 'The subscription ID has been copied to clipboard',
        }),
      )
      .catch(() =>
        toast({
          title: 'Failed to copy',
          description: 'Could not copy the subscription ID to clipboard',
        }),
      )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" size="icon">
            <MoreVertOutlined fontSize="small" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleCopyId}>
            Copy Subscription ID
          </DropdownMenuItem>
          {subscription.status !== 'canceled' &&
            (subscription.cancel_at_period_end ? (
              <DropdownMenuItem
                onClick={actions.uncancel.run}
                disabled={actions.uncancel.isPending}
              >
                Uncancel
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={cancellationModal.show}>
                Cancel Subscription
              </DropdownMenuItem>
            ))}
          {pauseAction === 'resume' ? (
            <DropdownMenuItem
              onClick={actions.resume.run}
              disabled={actions.resume.isPending}
            >
              Resume Now
            </DropdownMenuItem>
          ) : pauseAction === 'cancel_scheduled_pause' ? (
            <DropdownMenuItem
              onClick={actions.cancelScheduledPause.run}
              disabled={actions.cancelScheduledPause.isPending}
            >
              Cancel Scheduled Pause
            </DropdownMenuItem>
          ) : pauseAction === 'pause' ? (
            <DropdownMenuItem onClick={pauseModal.show}>
              Pause Subscription
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <InlineModal
        isShown={cancellationModal.isShown}
        hide={cancellationModal.hide}
        modalContent={
          <CancelSubscriptionModal
            subscription={subscription}
            onCancellation={cancellationModal.hide}
            hide={cancellationModal.hide}
          />
        }
      />
      <InlineModal
        isShown={pauseModal.isShown}
        hide={pauseModal.hide}
        modalContent={
          <PauseSubscriptionModal
            subscription={subscription}
            onPause={pauseModal.hide}
            hide={pauseModal.hide}
          />
        }
      />
    </>
  )
}

export default SubscriptionActionsMenu
