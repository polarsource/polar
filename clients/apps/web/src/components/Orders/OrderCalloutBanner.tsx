'use client'

import { isOrderDunningFailed, isPaymentNonRecoverable } from '@/utils/order'
import { schemas } from '@polar-sh/client'
import { addDays, isPast, min, parseISO } from 'date-fns'
import { OrderCalloutBannerCanceled } from './OrderCalloutBannerCanceled'
import { OrderCalloutBannerNonRecoverable } from './OrderCalloutBannerNonRecoverable'
import { OrderCalloutBannerRecovering } from './OrderCalloutBannerRecovering'

const DUNNING_TOTAL_RETRY_DAYS = 21

interface OrderCalloutBannerProps {
  organization: schemas['Organization']
  order: schemas['Order']
  subscription: schemas['Subscription']
  payments: schemas['Payment'][]
}

export const OrderCalloutBanner = ({
  organization,
  order,
  subscription,
  payments,
}: OrderCalloutBannerProps) => {
  const dunningFailed = isOrderDunningFailed(order, subscription, payments)

  const latestFailedPayment =
    payments
      .filter((payment) => payment.status === 'failed')
      .toSorted(
        (a, b) =>
          parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime(),
      )[0] ?? null

  const nonRecoverable =
    !dunningFailed &&
    latestFailedPayment !== null &&
    isPaymentNonRecoverable(latestFailedPayment)

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

  const declineMessage =
    latestFailedPayment?.decline_message ?? latestFailedPayment?.decline_reason

  const benefitsRevoked = benefitsRevocationDate
    ? isPast(benefitsRevocationDate)
    : false

  if (dunningFailed) {
    return (
      <OrderCalloutBannerCanceled
        finalAttemptAt={latestFailedPayment?.created_at ?? null}
        declineMessage={declineMessage}
        endedAt={subscription.ended_at}
        benefitsRevocationDate={benefitsRevocationDate}
        benefitsRevoked={benefitsRevoked}
      />
    )
  }

  if (nonRecoverable) {
    return (
      <OrderCalloutBannerNonRecoverable
        lastAttemptAt={latestFailedPayment?.created_at ?? null}
        declineMessage={declineMessage}
        revocationDeadline={revocationDeadline}
        benefitsRevocationDate={benefitsRevocationDate}
        benefitsRevoked={benefitsRevoked}
      />
    )
  }

  return (
    <OrderCalloutBannerRecovering
      lastAttemptAt={latestFailedPayment?.created_at ?? null}
      declineMessage={declineMessage}
      nextAttemptAt={order.next_payment_attempt_at ?? null}
      revocationDeadline={revocationDeadline}
      benefitsRevocationDate={benefitsRevocationDate}
      benefitsRevoked={benefitsRevoked}
    />
  )
}
