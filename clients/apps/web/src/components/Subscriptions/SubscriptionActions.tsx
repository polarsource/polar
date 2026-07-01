'use client'

import { toast } from '@/components/Toast/use-toast'
import { useUpdateSubscription } from '@/hooks/queries'
import { extractApiErrorMessage } from '@/utils/api/errors'
import MoreVertOutlined from '@mui/icons-material/MoreVertOutlined'
import { schemas } from '@polar-sh/client'
import { Button } from '@polar-sh/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@polar-sh/ui/components/atoms/DropdownMenu'
import React from 'react'

interface SubscriptionActionsProps {
  subscription: schemas['Subscription']
  onCancelSubscription: () => void
}

const SubscriptionActions: React.FC<SubscriptionActionsProps> = ({
  subscription,
  onCancelSubscription,
}) => {
  const updateSubscription = useUpdateSubscription(subscription.id)

  const handleUpdate = async (
    body: schemas['SubscriptionUpdate'],
    successTitle: string,
    successDescription: string,
  ) => {
    const { error } = await updateSubscription.mutateAsync(body)
    if (error) {
      toast({
        title: 'Error',
        description: extractApiErrorMessage(error),
      })
      return
    }
    toast({ title: successTitle, description: successDescription })
  }

  const handleUncancel = () =>
    handleUpdate(
      { cancel_at_period_end: false },
      'Subscription Uncanceled',
      'The subscription has been successfully uncanceled and will continue at the next billing cycle.',
    )

  const handlePause = () =>
    handleUpdate(
      { pause_at_period_end: true },
      'Subscription Pause Scheduled',
      'The subscription will be paused at the end of the current period. Billing stops and benefits are revoked until it is unpaused.',
    )

  const handleUnpause = () =>
    handleUpdate(
      { pause_at_period_end: false },
      subscription.status === 'paused'
        ? 'Subscription Unpaused'
        : 'Subscription Pause Unscheduled',
      subscription.status === 'paused'
        ? 'The subscription resumes immediately with a new billing period.'
        : 'The subscription will no longer be paused at the end of the current period.',
    )

  const isSeatBased = !!subscription.seats && subscription.seats > 0
  const canPause =
    subscription.status === 'active' &&
    !subscription.cancel_at_period_end &&
    !subscription.pause_at_period_end &&
    !subscription.ends_at &&
    !isSeatBased
  const canUnpause =
    subscription.pause_at_period_end === true ||
    subscription.status === 'paused'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="icon">
          <MoreVertOutlined fontSize="small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard
              .writeText(subscription.id)
              .then(() =>
                toast({
                  title: 'Subscription ID copied',
                  description:
                    'The subscription ID has been copied to clipboard',
                }),
              )
              .catch(() =>
                toast({
                  title: 'Failed to copy',
                  description:
                    'Could not copy the subscription ID to clipboard',
                }),
              )
          }}
        >
          Copy Subscription ID
        </DropdownMenuItem>
        {canPause && (
          <DropdownMenuItem
            onClick={handlePause}
            disabled={updateSubscription.isPending}
          >
            Pause Subscription
          </DropdownMenuItem>
        )}
        {canUnpause && (
          <DropdownMenuItem
            onClick={handleUnpause}
            disabled={updateSubscription.isPending}
          >
            {subscription.status === 'paused'
              ? 'Unpause Subscription'
              : "Don't Pause"}
          </DropdownMenuItem>
        )}
        {subscription.status !== 'canceled' &&
          (subscription.cancel_at_period_end ? (
            <DropdownMenuItem
              onClick={handleUncancel}
              disabled={updateSubscription.isPending}
            >
              Uncancel
            </DropdownMenuItem>
          ) : (
            subscription.status !== 'paused' && (
              <DropdownMenuItem onClick={onCancelSubscription}>
                Cancel Subscription
              </DropdownMenuItem>
            )
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default SubscriptionActions
