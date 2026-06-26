import { Client, schemas, unwrap } from '@polar-sh/client'
import { addDays, isPast, min, parseISO } from 'date-fns'
import { notFound } from 'next/navigation'
import { cache } from 'react'

const _getOrderById = async (
  api: Client,
  id: string,
): Promise<schemas['Order']> => {
  return unwrap(
    api.GET('/v1/orders/{id}', {
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
export const getOrderById = cache(_getOrderById)

/**
 * Determines if an order is eligible for payment retry
 */
export const canRetryOrderPayment = (
  order: schemas['CustomerOrder'],
): boolean => {
  return (
    order.status === 'pending' &&
    order.next_payment_attempt_at !== null &&
    order.subscription !== null
  )
}

const DUNNING_TOTAL_RETRY_DAYS = 21
export type OrderDunningState = 'recovering' | 'failed'

/**
 * Where a subscription order sits in the dunningflow:
 * - `recovering`: Polar is still retrying it.
 * - `failed`: retries are exhausted and the subscription was ended by Polar.
 * - `null`: the order isn't in dunning
 */
export function getOrderDunningState(
  order: schemas['Order'],
  subscription: schemas['Subscription'],
  payments: schemas['Payment'][],
): OrderDunningState | null {
  if (
    order.paid ||
    order.subscription_id === null ||
    !payments.some((payment) => payment.status === 'failed')
  ) {
    return null
  }

  if (order.next_payment_attempt_at !== null) {
    return 'recovering'
  }

  const endedByPolar =
    subscription.ended_at !== null &&
    subscription.customer_cancellation_reason === null

  return endedByPolar ? 'failed' : null
}

export function getBenefitsRevocationSchedule(
  organization: schemas['Organization'],
  subscription: schemas['Subscription'],
) {
  const pastDueAt = subscription.past_due_at
    ? parseISO(subscription.past_due_at)
    : null

  const revocationDeadline = pastDueAt
    ? addDays(pastDueAt, DUNNING_TOTAL_RETRY_DAYS)
    : null

  const gracePeriodDays =
    organization.subscription_settings.benefit_revocation_grace_period

  const benefitsRevocationDate = pastDueAt
    ? min(
      [addDays(pastDueAt, gracePeriodDays), revocationDeadline].filter(
        (date) => date !== null,
      ),
    )
    : null

  const benefitsRevoked = benefitsRevocationDate
    ? isPast(benefitsRevocationDate)
    : false

  return { revocationDeadline, benefitsRevocationDate, benefitsRevoked }
}
