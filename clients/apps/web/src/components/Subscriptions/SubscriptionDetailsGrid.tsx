'use client'

import { DetailCell, DetailGrid } from '@/components/Shared/Section'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text, TextArea } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ArrowUpRightIcon } from 'lucide-react'
import Link from 'next/link'
import { ScheduledUpdateSection } from './ScheduledUpdateSection'
import { SubscriptionStatus } from './SubscriptionStatus'
import { getScheduleRows } from './subscriptionState'

const formatRecurringSchedule = (
  interval: schemas['RecurringInterval'],
  intervalCount: number | null,
): string => {
  const count = intervalCount && intervalCount > 1 ? intervalCount : null
  const labels: Record<schemas['RecurringInterval'], string> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
    year: 'Year',
  }
  if (count) {
    return `Every ${count} ${labels[interval]}${count > 1 ? 's' : ''}`
  }
  const adverbs: Record<schemas['RecurringInterval'], string> = {
    day: 'Daily',
    week: 'Weekly',
    month: 'Monthly',
    year: 'Yearly',
  }
  return adverbs[interval] ?? interval
}

const CANCELLATION_REASONS: Record<string, string> = {
  unused: 'Unused',
  too_expensive: 'Too Expensive',
  missing_features: 'Missing Features',
  switched_service: 'Switched Service',
  customer_service: 'Customer Service',
  low_quality: 'Low Quality',
  too_complex: 'Too Complicated',
  other: 'Other',
}

export const SubscriptionDetailsGrid = ({
  subscription,
  product,
  organization,
}: {
  subscription: schemas['Subscription']
  product?: schemas['Product']
  organization: schemas['Organization']
}) => {
  const productName = product?.name ?? subscription.product.name

  const scheduleRows = getScheduleRows(subscription)
  const cancellationDate = subscription.ended_at ?? subscription.ends_at

  const cancellationReason = subscription.customer_cancellation_reason
  const cancellationComment = subscription.customer_cancellation_comment

  return (
    <>
      <DetailGrid>
        <DetailCell
          label="Product"
          value={
            <Link
              href={`/dashboard/${organization.slug}/products/${subscription.product.id}`}
            >
              <Box
                as="span"
                display="inline-flex"
                alignItems="center"
                columnGap="s"
              >
                <Text as="span" variant="body" truncate>
                  {productName}
                </Text>
                <Box as="span" display="inline-flex">
                  <ArrowUpRightIcon size={16} />
                </Box>
              </Box>
            </Link>
          }
        />
        <DetailCell
          label="Status"
          value={<SubscriptionStatus subscription={subscription} />}
        />
        <DetailCell
          label="Billing schedule"
          value={formatRecurringSchedule(
            subscription.recurring_interval,
            subscription.recurring_interval_count,
          )}
        />
        <DetailCell
          label="Started"
          value={
            <Text variant="body" as="span">
              <FormattedDateTime datetime={subscription.created_at} />
            </Text>
          }
        />
        {scheduleRows.map((row) => (
          <DetailCell
            key={row.key}
            label={row.label}
            value={
              row.datetime ? (
                <Text variant="body" as="span">
                  <FormattedDateTime datetime={row.datetime} />
                </Text>
              ) : (
                <Text variant="body" as="span" color="muted">
                  {row.fallback}
                </Text>
              )
            }
          />
        ))}
        <DetailCell
          label="Discount"
          value={
            subscription.discount ? (
              <Link
                href={`/dashboard/${organization.slug}/products/discounts?query=${subscription.discount.code}`}
              >
                <Box
                  as="span"
                  display="inline-flex"
                  alignItems="center"
                  columnGap="s"
                >
                  <Text as="span" variant="body" truncate>
                    {subscription.discount.name}
                  </Text>
                  <Box as="span" display="inline-flex">
                    <ArrowUpRightIcon size={16} />
                  </Box>
                </Box>
              </Link>
            ) : undefined
          }
        />
        <DetailCell
          label="Amount"
          value={
            subscription.amount
              ? formatCurrency('compact')(
                  subscription.amount,
                  subscription.currency,
                )
              : undefined
          }
        />
      </DetailGrid>

      {subscription.pending_update && (
        <Box
          flexDirection="column"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          paddingTop="4xl"
        >
          <ScheduledUpdateSection
            pendingUpdate={subscription.pending_update}
            subscription={subscription}
          />
        </Box>
      )}

      {cancellationDate && (
        <Box
          flexDirection="column"
          rowGap="xl"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          paddingTop="4xl"
        >
          <Text variant="heading-xxs" as="h3">
            Cancellation details
          </Text>
          <DetailGrid>
            <DetailCell
              label="Ends"
              value={
                <Text variant="body" as="span">
                  <FormattedDateTime datetime={cancellationDate} />
                </Text>
              }
            />
            <DetailCell
              label="Reason"
              value={
                cancellationReason
                  ? (CANCELLATION_REASONS[cancellationReason] ??
                    cancellationReason)
                  : undefined
              }
            />
          </DetailGrid>
          {cancellationComment && (
            <TextArea
              tabIndex={-1}
              readOnly
              resizable={false}
              value={cancellationComment}
            />
          )}
        </Box>
      )}
    </>
  )
}
