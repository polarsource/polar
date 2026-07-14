'use client'

import {
  getLatestFailedPayment,
  isOrderDunningFailed,
  isOrderNonRecoverable,
} from '@/utils/order'
import { schemas } from '@polar-sh/client'
import { Pill, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { addDays, isPast, min, parseISO } from 'date-fns'
import { ExternalLinkIcon } from 'lucide-react'
import { Children, type ReactNode } from 'react'

const DUNNING_TOTAL_RETRY_DAYS = 21

const FAILED_PAYMENTS_DOCS_URL =
  'https://docs.polar.sh/features/subscriptions/failed-payments'

const BannerFrame = ({
  heading,
  children,
}: {
  heading: string
  children: ReactNode
}) => (
  <Box flexDirection="column" rowGap="l">
    <Text variant="heading-xxs">{heading}</Text>

    <Box
      display="grid"
      gridTemplateColumns={{
        base: '1fr',
        lg: `repeat(${Children.count(children)}, 1fr)`,
      }}
      borderColor="border-primary"
      borderWidth={1}
      borderStyle="solid"
      borderRadius="l"
    >
      {children}
    </Box>
  </Box>
)

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
    paddingVertical="xl"
    paddingHorizontal="xl"
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
  datetime?: Date | string | null
  resolution?: 'time' | 'day'
}) => (
  <Box flexDirection="column" rowGap="xs">
    <Text color="muted">{label}</Text>
    {datetime ? (
      <Text variant="body">
        <FormattedDateTime resolution={resolution} datetime={datetime} />
      </Text>
    ) : null}
  </Box>
)

const DeclineReasonBox = ({
  declineMessage,
  unrecoverable = false,
}: {
  declineMessage: string
  unrecoverable?: boolean
}) => (
  <Box
    flexDirection="column"
    rowGap="xs"
    backgroundColor="background-card"
    borderRadius="s"
    padding="l"
  >
    <Box alignItems="center" justifyContent="between" columnGap="s">
      <Text variant="caption" color="muted">
        Bank Decline Reason
      </Text>
      {unrecoverable ? <Pill color="red">Unrecoverable</Pill> : null}
    </Box>
    <Text>{declineMessage}</Text>
    {unrecoverable ? (
      <Text variant="caption" color="muted">
        This reason is permanent — every retry fails the same way, so the card
        can&apos;t be charged again.
      </Text>
    ) : null}
  </Box>
)

const LearnMoreLink = () => (
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
)

const BenefitsRevocationText = ({
  benefitsRevoked,
  benefitsRevocationDate,
}: {
  benefitsRevoked: boolean
  benefitsRevocationDate: Date | null
}) => (
  <Text>
    Benefits {benefitsRevoked ? 'were revoked' : 'will be revoked'}
    {benefitsRevocationDate ? (
      <>
        {' on '}
        <FormattedDateTime resolution="day" datetime={benefitsRevocationDate} />
      </>
    ) : null}
    .
  </Text>
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
  const latestFailedPayment = getLatestFailedPayment(payments)
  const nonRecoverable = isOrderNonRecoverable(order, subscription, payments)

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

  const attemptAt = latestFailedPayment?.created_at ?? null

  if (dunningFailed) {
    return (
      <BannerFrame heading="Payment couldn't be recovered">
        <BannerColumn>
          <ColumnHeading
            label="Final attempt"
            datetime={attemptAt}
            resolution="time"
          />
          {declineMessage ? (
            <DeclineReasonBox declineMessage={declineMessage} />
          ) : null}
        </BannerColumn>

        <BannerColumn divided>
          <ColumnHeading
            label="Subscription canceled"
            datetime={subscription.ended_at}
          />
          <BenefitsRevocationText
            benefitsRevoked={benefitsRevoked}
            benefitsRevocationDate={benefitsRevocationDate}
          />
        </BannerColumn>
      </BannerFrame>
    )
  }

  if (nonRecoverable) {
    return (
      <BannerFrame heading="Payment method can't be charged">
        <BannerColumn>
          <ColumnHeading
            label="Last attempt"
            datetime={attemptAt}
            resolution="time"
          />
          {declineMessage ? (
            <DeclineReasonBox declineMessage={declineMessage} unrecoverable />
          ) : null}
        </BannerColumn>

        <BannerColumn divided>
          <ColumnHeading
            label={
              revocationDeadline
                ? 'Subscription will be canceled on'
                : 'Subscription will be canceled'
            }
            datetime={revocationDeadline}
          />
          <Text>
            The subscription will be canceled unless the customer updates their
            payment method.
          </Text>
          <BenefitsRevocationText
            benefitsRevoked={benefitsRevoked}
            benefitsRevocationDate={benefitsRevocationDate}
          />
          <LearnMoreLink />
        </BannerColumn>
      </BannerFrame>
    )
  }

  return (
    <BannerFrame heading="Payment Failed">
      <BannerColumn>
        <ColumnHeading
          label="Last attempt"
          datetime={attemptAt}
          resolution="time"
        />
        {declineMessage ? (
          <DeclineReasonBox declineMessage={declineMessage} />
        ) : null}
      </BannerColumn>

      <BannerColumn divided>
        <ColumnHeading
          label="Next attempt"
          datetime={order.next_payment_attempt_at ?? null}
        />
        <Text>
          Polar always tries to recover failed subscription payments for you.
        </Text>
        <LearnMoreLink />
      </BannerColumn>

      <BannerColumn divided>
        <ColumnHeading
          label="What happens next"
          datetime={revocationDeadline}
        />
        <Text>
          If we can&apos;t recover the payment, the subscription will be
          canceled
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
        <BenefitsRevocationText
          benefitsRevoked={benefitsRevoked}
          benefitsRevocationDate={benefitsRevocationDate}
        />
      </BannerColumn>
    </BannerFrame>
  )
}
