'use client'

import { usePayments } from '@/hooks/queries/payments'
import {
  getOrderDunningState,
  getBenefitsRevocationSchedule,
} from '@/utils/order'
import { schemas } from '@polar-sh/client'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ExternalLinkIcon } from 'lucide-react'
import type { ReactNode } from 'react'

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
    paddingVertical="xl"
    paddingHorizontal="2xl"
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
      <Text variant="body">
        <FormattedDateTime resolution={resolution} datetime={datetime} />
      </Text>
    ) : null}
  </Box>
)

const BenefitsRevocationText = ({
  benefitsRevocationDate,
  benefitsRevoked,
}: {
  benefitsRevocationDate: Date | null
  benefitsRevoked: boolean
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
  subscription: schemas['Subscription']
  order: schemas['Order']
}

export const OrderCalloutBanner = ({
  organization,
  subscription,
  order,
}: OrderCalloutBannerProps) => {
  const { data: paymentsData } = usePayments(
    organization.id,
    { order_id: order.id },
    { enabled: !!order.subscription_id },
  )
  const payments = paymentsData?.items ?? []

  const dunningState = getOrderDunningState(order, subscription, payments)

  const { benefitsRevocationDate, benefitsRevoked, revocationDeadline } =
    getBenefitsRevocationSchedule(organization, subscription)

  const latestFailedPayment =
    payments
      .filter((payment) => payment.status === 'failed')
      .toSorted(
        (a, b) =>
          parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime(),
      )[0] ?? null

  const failedPaymentDisplayMessage =
    latestFailedPayment?.decline_message ?? latestFailedPayment?.decline_reason

  if (!dunningState) {
    return null
  }

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
        paddingHorizontal="2xl"
        paddingVertical="l"
      >
        <Text variant="body">
          {dunningState === 'failed'
            ? "Payment couldn't be recovered"
            : 'Payment Failed'}
        </Text>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{
          base: '1fr',
          lg: dunningState === 'failed' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        }}
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <BannerColumn>
          <ColumnHeading
            label={dunningState === 'failed' ? 'Final attempt' : 'Last attempt'}
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

        {dunningState === 'failed' ? (
          <BannerColumn divided>
            <ColumnHeading
              label="Subscription canceled"
              datetime={subscription.ended_at}
            />
            <BenefitsRevocationText
              benefitsRevocationDate={benefitsRevocationDate}
              benefitsRevoked={benefitsRevoked}
            />
          </BannerColumn>
        ) : (
          <>
            <BannerColumn divided>
              <ColumnHeading
                label="Next attempt"
                datetime={order.next_payment_attempt_at ?? null}
              />
              <Text>
                Polar always tries to recover failed subscription payments for
                you.
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
                benefitsRevocationDate={benefitsRevocationDate}
                benefitsRevoked={benefitsRevoked}
              />
            </BannerColumn>
          </>
        )}
      </Box>
    </Box>
  )
}
