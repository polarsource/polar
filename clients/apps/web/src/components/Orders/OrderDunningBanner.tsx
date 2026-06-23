'use client'

import { schemas } from '@polar-sh/client'
import { Status, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { addDays, parseISO } from 'date-fns'

const DUNNING_RETRY_COUNT = 4
const DUNNING_TOTAL_RETRY_DAYS = 21
const DUNNING_COUNTING_TRIGGERS = new Set<schemas['PaymentTrigger']>([
  'purchase',
  'subscription_cycle',
  'retry_dunning',
])

interface OrderDunningBannerProps {
  organization: schemas['Organization']
  order: schemas['Order']
  subscription: schemas['Subscription']
  payments: schemas['Payment'][]
}

export const OrderDunningBanner = ({
  organization,
  order,
  subscription,
  payments,
}: OrderDunningBannerProps) => {
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

  return (
    <Box
      display="grid"
      gridTemplateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }}
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
        padding="xl"
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
          {latestFailedPayment?.decline_message ??
          latestFailedPayment?.decline_reason ? (
            <Text>
              {latestFailedPayment.decline_message ??
                latestFailedPayment.decline_reason}
            </Text>
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
        padding="xl"
        justifyContent="center"
        borderLeftWidth={{ base: 0, lg: 1 }}
        borderTopWidth={{ base: 1, lg: 0 }}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box flexDirection="column" rowGap="xs">
          <Text color="muted">What happens next</Text>
          <Text as="strong" variant="body">
            Retry{' '}
            {Math.min(Math.max(failedDunningAttempts, 1), DUNNING_RETRY_COUNT)}{' '}
            of {DUNNING_RETRY_COUNT}
          </Text>
          {order.next_payment_attempt_at ? (
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
          {revocationDeadline ? (
            <Text color="muted">
              If all retries fail, the subscription is canceled by{' '}
              <FormattedDateTime
                dateStyle="medium"
                resolution="day"
                datetime={revocationDeadline.toISOString()}
              />
              .
            </Text>
          ) : (
            <Text color="muted">
              If all retries fail, the subscription is canceled.
            </Text>
          )}
          <Text color="muted">
            {gracePeriodDays > 0
              ? `Benefits stay active for ${gracePeriodDays} ${
                  gracePeriodDays === 1 ? 'day' : 'days'
                } after cancellation, then are revoked.`
              : 'Benefits are revoked as soon as the subscription is canceled.'}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
