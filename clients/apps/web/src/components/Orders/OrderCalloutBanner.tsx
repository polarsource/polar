'use client'

import { schemas } from '@polar-sh/client'
import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { addDays, min, parseISO } from 'date-fns'

const DUNNING_RETRY_COUNT = 4
const DUNNING_MAX_ATTEMPTS = DUNNING_RETRY_COUNT + 1
const DUNNING_TOTAL_RETRY_DAYS = 21
const DUNNING_COUNTING_TRIGGERS = new Set<schemas['PaymentTrigger']>([
  'purchase',
  'subscription_cycle',
  'retry_dunning',
])

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
  const failedDunningAttempts = payments.filter(
    (payment) =>
      payment.status === 'failed' &&
      typeof payment.trigger === 'string' &&
      DUNNING_COUNTING_TRIGGERS.has(payment.trigger),
  ).length

  const latestFailedPayment =
    payments
      .filter((payment) => payment.status === 'failed')
      .toSorted(
        (a, b) =>
          parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime(),
      )[0] ?? null

  const revocationDeadline = subscription.past_due_at
    ? addDays(parseISO(subscription.past_due_at), DUNNING_TOTAL_RETRY_DAYS)
    : null

  const gracePeriodDays =
    organization.subscription_settings.benefit_revocation_grace_period

  const cancellationDate = subscription.ended_at
    ? parseISO(subscription.ended_at)
    : revocationDeadline

  const benefitsRevocationDate = subscription.past_due_at
    ? min(
        [
          addDays(parseISO(subscription.past_due_at), gracePeriodDays),
          cancellationDate,
        ].filter((date) => date !== null),
      )
    : null

  const benefitsRevoked =
    benefitsRevocationDate !== null && benefitsRevocationDate < new Date()

  const failedPaymentDisplayMessage =
    latestFailedPayment?.decline_message ?? latestFailedPayment?.decline_reason

  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: '1fr', xl: 'repeat(2, minmax(0, 1fr))' }}
      alignItems="stretch"
      overflow="hidden"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-card-raised"
    >
      <Box
        flexDirection="column"
        rowGap="l"
        padding={{ base: 'l', md: 'xl' }}
        justifyContent="center"
      >
        <Box flexDirection="column" rowGap="m">
          <Box alignItems="center" columnGap="m" flexWrap="wrap" rowGap="s">
            <Text as="strong" variant="body">
              Payment failed
            </Text>
            <Status
              status={
                subscription.status === 'past_due'
                  ? 'Past due'
                  : 'Renewal failed'
              }
              color="red"
              size="small"
            />
          </Box>
          {failedPaymentDisplayMessage ? (
            <Text>{failedPaymentDisplayMessage}</Text>
          ) : null}
          {latestFailedPayment ? (
            <Text color="muted">
              Last attempt{' '}
              <Text as="span" color="default">
                <FormattedDateTime
                  dateStyle="medium"
                  resolution="time"
                  datetime={latestFailedPayment.created_at}
                />
              </Text>
            </Text>
          ) : null}
        </Box>
      </Box>

      <Box
        flexDirection="column"
        rowGap="l"
        padding={{ base: 'l', md: 'xl' }}
        justifyContent="center"
        borderLeftWidth={{ base: 0, xl: 1 }}
        borderTopWidth={{ base: 1, xl: 0 }}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box flexDirection="column" rowGap="xs">
          <Text color="muted">
            {subscription.ended_at !== null ? 'Outcome' : 'What happens next'}
          </Text>
          <Text as="strong" variant="body">
            Attempt{' '}
            {Math.min(Math.max(failedDunningAttempts, 1), DUNNING_MAX_ATTEMPTS)}{' '}
            of {DUNNING_MAX_ATTEMPTS}
          </Text>
          {subscription.ended_at ? null : order.next_payment_attempt_at ? (
            <Text color="muted">
              Next automatic retry{' '}
              <Text as="span" color="default">
                <FormattedDateTime
                  dateStyle="medium"
                  resolution="time"
                  datetime={order.next_payment_attempt_at}
                />
              </Text>
            </Text>
          ) : (
            <Text color="muted">
              No further automatic retries are scheduled for this order.
            </Text>
          )}
          {subscription.ended_at ? (
            <Text color="muted">
              The subscription was canceled on{' '}
              <Text as="span" color="default">
                <FormattedDateTime
                  dateStyle="medium"
                  resolution="day"
                  datetime={subscription.ended_at}
                />
              </Text>
              .
            </Text>
          ) : revocationDeadline ? (
            <Text color="muted">
              If all retries fail, the subscription is canceled by{' '}
              <Text as="span" color="default">
                <FormattedDateTime
                  dateStyle="medium"
                  resolution="day"
                  datetime={revocationDeadline.toISOString()}
                />
              </Text>
              .
            </Text>
          ) : (
            <Text color="muted">
              If all retries fail, the subscription is canceled.
            </Text>
          )}
          {benefitsRevocationDate ? (
            <Text color="muted">
              {benefitsRevoked
                ? 'Benefits were revoked on '
                : 'Benefits stay active until '}
              <Text as="span" color="default">
                <FormattedDateTime
                  dateStyle="medium"
                  resolution="day"
                  datetime={benefitsRevocationDate.toISOString()}
                />
              </Text>
              {benefitsRevoked ? '.' : ', then are revoked.'}
            </Text>
          ) : (
            <Text color="muted">
              Benefits are revoked as soon as the subscription is canceled.
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  )
}
