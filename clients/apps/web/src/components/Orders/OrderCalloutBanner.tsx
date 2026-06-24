'use client'

import { isOrderDunningFailed } from '@/utils/order'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { addDays, isPast, min, parseISO } from 'date-fns'
import { ExternalLinkIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const DUNNING_TOTAL_RETRY_DAYS = 21

const FAILED_PAYMENTS_DOCS_URL =
  'https://docs.polar.sh/features/subscriptions/failed-payments'

const BannerColumn = ({
  divided = false,
  children,
}: {
  divided?: boolean
  children: ReactNode
}) => (
  <Box
    flexDirection="column"
    rowGap="m"
    padding="xl"
    borderTopWidth={divided ? { base: 1, lg: 0 } : undefined}
    borderLeftWidth={divided ? { base: 0, lg: 1 } : undefined}
    borderStyle={divided ? 'solid' : undefined}
    borderColor={divided ? 'border-primary' : undefined}
  >
    {children}
  </Box>
)

const ColumnHeading = ({
  label,
  datetime,
  resolution = 'day',
}: {
  label: string
  datetime: Date | string | null
  resolution?: 'time' | 'day'
}) => (
  <Box flexDirection="column" rowGap="xs">
    <Text color="muted">{label}</Text>
    {datetime ? (
      <Text variant="heading-xxs">
        <FormattedDateTime
          resolution={resolution}
          datetime={datetime}
        />
      </Text>
    ) : null}
  </Box>
)

const CanceledColumn = ({
  endedAt,
  benefitsRevocationDate,
  benefitsRevoked,
}: {
  endedAt: string | null
  benefitsRevocationDate: Date | null
  benefitsRevoked: boolean
}) => (
  <BannerColumn divided>
    <ColumnHeading label="Subscription canceled" datetime={endedAt} />
    <Text>
      Benefits {benefitsRevoked ? 'were revoked' : 'will be revoked'}
      {benefitsRevocationDate ? (
        <>
          {' on '}
          <FormattedDateTime
            resolution="day"
            datetime={benefitsRevocationDate}
          />
        </>
      ) : null}
      .
    </Text>
  </BannerColumn>
)

const RecoveringColumns = ({
  nextAttemptAt,
  revocationDeadline,
  benefitsRevocationDate,
  benefitsRevoked,
}: {
  nextAttemptAt: string | null
  revocationDeadline: Date | null
  benefitsRevocationDate: Date | null
  benefitsRevoked: boolean
}) => (
  <>
    <BannerColumn divided>
      <ColumnHeading label="Next attempt" datetime={nextAttemptAt} />
      <Text>
        Polar always tries to recover failed subscription payments for you.
      </Text>
      <a
        href={FAILED_PAYMENTS_DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-fit"
      >
        <Box as="span" display="inline-flex" alignItems="center" columnGap="xs">
          <Text as="span">
            <span className="underline">Learn more</span>
          </Text>
          <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
        </Box>
      </a>
    </BannerColumn>

    <BannerColumn divided>
      <ColumnHeading label="What happens next" datetime={revocationDeadline} />
      <Text>
        If we can&apos;t recover the payment, the subscription will be canceled
        {revocationDeadline ? (
          <>
            {' on '}
            <FormattedDateTime
              resolution="day"
              datetime={revocationDeadline}
            />
          </>
        ) : null}
        .
      </Text>
      <Text>
        Benefits {benefitsRevoked ? 'were revoked' : 'will be revoked'}
        {benefitsRevocationDate ? (
          <>
            {' on '}
            <FormattedDateTime
              resolution="day"
              datetime={benefitsRevocationDate}
            />
          </>
        ) : null}
        .
      </Text>
    </BannerColumn>
  </>
)

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

  const failedPaymentDisplayMessage =
    latestFailedPayment?.decline_message ?? latestFailedPayment?.decline_reason

  const benefitsRevokedInPast = benefitsRevocationDate
    ? isPast(benefitsRevocationDate)
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
          {dunningFailed ? "Payment couldn't be recovered" : 'Payment Failed'}
        </Text>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{
          base: '1fr',
          lg: dunningFailed ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        }}
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <BannerColumn>
          <ColumnHeading
            label="Last attempt"
            datetime={latestFailedPayment?.created_at ?? null}
            resolution="time"
          />
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
        </BannerColumn>

        {dunningFailed ? (
          <CanceledColumn
            endedAt={subscription.ended_at}
            benefitsRevocationDate={benefitsRevocationDate}
            benefitsRevoked={benefitsRevokedInPast}
          />
        ) : (
          <RecoveringColumns
            nextAttemptAt={order.next_payment_attempt_at ?? null}
            revocationDeadline={revocationDeadline}
            benefitsRevocationDate={benefitsRevocationDate}
            benefitsRevoked={benefitsRevokedInPast}
          />
        )}
      </Box>
    </Box>
  )
}
