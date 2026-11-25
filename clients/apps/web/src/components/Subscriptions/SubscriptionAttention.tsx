'use client'

import { schemas } from '@polar-sh/client'
import {
  Alert,
  type AlertVariant,
  type ButtonGroupActions,
} from '@polar-sh/orbit'
import { format } from 'date-fns'
import { useSubscriptionActions } from './useSubscriptionActions'

const formatDate = (value: string) => format(new Date(value), 'MMM d, yyyy')

interface Attention {
  variant: AlertVariant
  title: string
  description?: string
  actions?: ButtonGroupActions
}

// What the subscription needs from the merchant right now, with the one action
// that settles it. Nothing is shown for a subscription that is just running.
export const SubscriptionAttention = ({
  subscription,
}: {
  subscription: schemas['Subscription']
}) => {
  const actions = useSubscriptionActions(subscription.id)

  const getAttention = (): Attention | null => {
    if (subscription.ended_at) return null

    if (subscription.status === 'trial_ended') {
      return {
        variant: 'warning',
        title: 'Trial ended without a payment method',
      }
    }
    if (subscription.cancel_at_period_end) {
      return {
        variant: 'warning',
        title: subscription.ends_at
          ? `Ends on ${formatDate(subscription.ends_at)}`
          : 'Ends at the end of the period',
        description: 'The customer keeps access until then.',
        actions: [
          {
            text: 'Uncancel',
            onClick: actions.uncancel.run,
            loading: actions.uncancel.isPending,
          },
        ],
      }
    }
    if (subscription.status === 'paused') {
      return {
        variant: 'info',
        title: subscription.resumes_at
          ? `Paused, resumes on ${formatDate(subscription.resumes_at)}`
          : 'Paused until resumed',
        description: 'Resuming charges for a new billing period.',
        actions: [
          {
            text: 'Resume now',
            onClick: actions.resume.run,
            loading: actions.resume.isPending,
          },
        ],
      }
    }
    if (subscription.pause_at_period_end) {
      return {
        variant: 'info',
        title: `Pauses on ${formatDate(subscription.current_period_end)}`,
        description: subscription.resumes_at
          ? `Resumes on ${formatDate(subscription.resumes_at)}.`
          : undefined,
        actions: [
          {
            text: 'Cancel scheduled pause',
            onClick: actions.cancelScheduledPause.run,
            loading: actions.cancelScheduledPause.isPending,
          },
        ],
      }
    }
    return null
  }

  const attention = getAttention()
  return attention ? <Alert {...attention} /> : null
}
