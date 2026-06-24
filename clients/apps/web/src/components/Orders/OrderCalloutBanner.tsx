'use client'

import PaymentMethod from '@/components/PaymentMethod/PaymentMethod'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { addDays, isPast, min, parseISO } from 'date-fns'
import { ExternalLinkIcon } from 'lucide-react'

const DUNNING_TOTAL_RETRY_DAYS = 21

const FAILED_PAYMENTS_DOCS_URL =
  'https://docs.polar.sh/features/subscriptions/failed-payments'

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

  const benefitsRevocationDate = subscription.past_due_at
    ? min(
      [
        addDays(parseISO(subscription.past_due_at), gracePeriodDays),
        revocationDeadline,
      ].filter((date) => date !== null),
    )
    : null

  const failedPaymentDisplayMessage =
    latestFailedPayment?.decline_message ?? latestFailedPayment?.decline_reason

  const benefitsRevokedInPast = benefitsRevocationDate
    ? isPast(benefitsRevocationDate)
    : false
  const subscriptionCanceledInPast = revocationDeadline
    ? isPast(revocationDeadline)
    : false

  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Box
        alignItems="center"
        columnGap="m"
        paddingHorizontal="xl"
        paddingVertical="l"
      >
        <Text variant="heading-xxs" as="strong">
          Payment Failed
        </Text>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }}
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box flexDirection="column" rowGap="m" padding="xl">
          <Box flexDirection="column" rowGap="xs">
            <Text color="muted">Last attempt</Text>
            {latestFailedPayment ? (
              <Text variant="heading-xxs">
                <FormattedDateTime
                  resolution="time"
                  showYear={false}
                  datetime={latestFailedPayment.created_at}
                />
              </Text>
            ) : null}
          </Box>
          {latestFailedPayment ? (
            <span className="text-sm">
              <PaymentMethod payment={latestFailedPayment} />
            </span>
          ) : null}
          {failedPaymentDisplayMessage ? (
            <Box
              flexDirection="column"
              rowGap="xs"
              backgroundColor="background-card"
              borderRadius="m"
              padding="l"
            >
              <Text variant="caption" color="muted">
                Bank Decline Reason
              </Text>
              <Text>{failedPaymentDisplayMessage}</Text>
            </Box>
          ) : null}
        </Box>

        <Box
          flexDirection="column"
          rowGap="m"
          padding="xl"
          borderTopWidth={{ base: 1, lg: 0 }}
          borderLeftWidth={{ base: 0, lg: 1 }}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <Box flexDirection="column" rowGap="xs">
            <Text color="muted">Next attempt</Text>
            {order.next_payment_attempt_at ? (
              <Text variant="heading-xxs">
                <FormattedDateTime
                  resolution="day"
                  showYear={false}
                  datetime={order.next_payment_attempt_at}
                />
              </Text>
            ) : null}
          </Box>
          <Text>
            Polar always tries to recover failed subscription payments for you.
          </Text>
          <a
            href={FAILED_PAYMENTS_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit"
          >
            <Box
              as="span"
              display="inline-flex"
              alignItems="center"
              columnGap="xs"
            >
              <Text as="span">
                <span className="underline">Learn more</span>
              </Text>
              <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
            </Box>
          </a>
        </Box>

        <Box
          flexDirection="column"
          rowGap="m"
          padding="xl"
          borderTopWidth={{ base: 1, lg: 0 }}
          borderLeftWidth={{ base: 0, lg: 1 }}
          borderStyle="solid"
          borderColor="border-primary"
        >
          <Box flexDirection="column" rowGap="xs">
            <Text color="muted">What happens next</Text>
            {revocationDeadline ? (
              <Text variant="heading-xxs">
                <FormattedDateTime
                  resolution="day"
                  showYear={false}
                  datetime={revocationDeadline.toISOString()}
                />
              </Text>
            ) : null}
          </Box>
          <Text>
            If we can&apos;t recover the payment, the subscription{' '}
            {subscriptionCanceledInPast ? 'was canceled' : 'will be canceled'}
            {revocationDeadline ? (
              <>
                {' on '}
                <FormattedDateTime
                  resolution="day"
                  showYear={false}
                  datetime={revocationDeadline.toISOString()}
                />
              </>
            ) : null}
            .
          </Text>
          <Text>
            Benefits{' '}
            {benefitsRevokedInPast ? 'were revoked' : 'will be revoked'}
            {benefitsRevocationDate ? (
              <>
                {' on '}
                <FormattedDateTime
                  resolution="day"
                  showYear={false}
                  datetime={benefitsRevocationDate.toISOString()}
                />
              </>
            ) : null}
            .
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
