'use client'

import { useModal } from '@/components/Modal/useModal'
import CancelSubscriptionModal from '@/components/Subscriptions/CancelSubscriptionModal'
import PauseSubscriptionModal from '@/components/Subscriptions/PauseSubscriptionModal'
import { toast } from '@/components/Toast/use-toast'
import {
  useCancelScheduledPause,
  useResumeSubscription,
  useUncancelSubscription,
} from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import { Button, InlineModal } from '@polar-sh/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import { getPauseAction } from './subscriptionState'

interface SubscriptionActionsMenuProps {
  subscription: schemas['Subscription']
}

const SubscriptionActionsMenu = ({
  subscription,
}: SubscriptionActionsMenuProps) => {
  const cancellationModal = useModal()
  const pauseModal = useModal()

  const pauseAction = getPauseAction(subscription)

  const uncancelSubscription = useUncancelSubscription(subscription.id)
  const resumeSubscription = useResumeSubscription(subscription.id)
  const cancelScheduledPause = useCancelScheduledPause(subscription.id)

  const handleUncancel = async () => {
    try {
      await uncancelSubscription.mutateAsync()
      toast({
        title: 'Subscription Uncanceled',
        description:
          'The subscription has been uncanceled and will continue at the next billing cycle.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to uncancel the subscription: ${extractApiErrorMessage(error as Record<string, unknown>)}`,
      })
    }
  }

  const handleResume = async () => {
    try {
      await resumeSubscription.mutateAsync()
      toast({
        title: 'Subscription Resumed',
        description:
          'The subscription has been resumed and charged for a new billing period.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to resume the subscription: ${extractApiErrorMessage(error as Record<string, unknown>)}`,
      })
    }
  }

  const handleCancelScheduledPause = async () => {
    try {
      await cancelScheduledPause.mutateAsync()
      toast({
        title: 'Scheduled Pause Canceled',
        description:
          'The subscription will no longer be paused at the end of the period.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to cancel the scheduled pause: ${extractApiErrorMessage(error as Record<string, unknown>)}`,
      })
    }
  }

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
                onClick={handleUncancel}
                disabled={uncancelSubscription.isPending}
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
              onClick={handleResume}
              disabled={resumeSubscription.isPending}
            >
              Resume Now
            </DropdownMenuItem>
          ) : pauseAction === 'cancel_scheduled_pause' ? (
            <DropdownMenuItem
              onClick={handleCancelScheduledPause}
              disabled={cancelScheduledPause.isPending}
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
