import { Client, schemas, unwrap } from '@polar-sh/client'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getSubscriptionById = async (
  api: Client,
  id: string,
): Promise<schemas['Subscription']> => {
  return unwrap(
    api.GET('/v1/subscriptions/{id}', {
      params: {
        path: {
          id,
        },
      },
      cache: 'no-store',
    }),
    {
      404: notFound,
    },
  )
}

// Tell React to memoize it for the duration of the request
export const getSubscriptionById = cache(_getSubscriptionById)

export type PauseActionSubscription = Pick<
  schemas['Subscription'],
  'status' | 'pause_at_period_end' | 'cancel_at_period_end' | 'ended_at'
>

export type PauseAction = 'resume' | 'cancel_scheduled_pause' | 'pause' | null

export const getPauseAction = (
  subscription: PauseActionSubscription,
): PauseAction => {
  if (subscription.ended_at) {
    return null
  }

  if (subscription.status === 'paused') {
    return 'resume'
  }

  if (subscription.status !== 'active' || subscription.cancel_at_period_end) {
    return null
  }

  return subscription.pause_at_period_end ? 'cancel_scheduled_pause' : 'pause'
}
