'use client'

import { DetailCell, DetailGrid } from '@/components/Orders/OrderSection'
import { CatalogVersionLabel } from '@/components/Products/CatalogVersionLabel'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import { ArrowUpRight as ArrowUpRightIcon } from '@polar-sh/orbit/icons'
import Link from 'next/link'
import { ScheduledUpdateSection } from './ScheduledUpdateSection'
import { SubscriptionStatus } from './SubscriptionStatus'

export const formatRecurringSchedule = (
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

// Why the customer canceled, in words. Null when they gave no reason.
export const getCancellationReason = (
  subscription: schemas['Subscription'],
): string | null => {
  const reason = subscription.customer_cancellation_reason
  return reason ? (CANCELLATION_REASONS[reason] ?? reason) : null
}

export interface SubscriptionKeyDate {
  label: string
  // Null for a pause with no date set to end it.
  datetime: string | null
}

// The dates that say where a subscription is in its life, in the order they
// are shown.
export const getSubscriptionKeyDates = (
  subscription: schemas['Subscription'],
): SubscriptionKeyDate[] => {
  const trialEnd =
    subscription.status === 'trialing' ? subscription.trial_end : null

  let nextEvent: string | undefined
  if (subscription.ended_at) {
    nextEvent = undefined
  } else if (subscription.ends_at) {
    nextEvent = subscription.ends_at
  } else if (
    subscription.status !== 'paused' &&
    subscription.current_period_end
  ) {
    nextEvent = subscription.current_period_end
  }
  // While trialing the API holds `trial_end` and the next event on the same
  // date, so the two would repeat each other under different labels.
  if (nextEvent === trialEnd) {
    nextEvent = undefined
  }

  const dates: SubscriptionKeyDate[] = [
    { label: 'Started', datetime: subscription.started_at },
  ]
  if (trialEnd) dates.push({ label: 'Trial ends', datetime: trialEnd })
  if (nextEvent) {
    dates.push({
      label: subscription.ends_at
        ? 'Ending date'
        : subscription.pause_at_period_end
          ? 'Pauses on'
          : 'Renewal date',
      datetime: nextEvent,
    })
  }
  if (subscription.status === 'paused' && subscription.paused_at) {
    dates.push({ label: 'Paused on', datetime: subscription.paused_at })
  }
  if (subscription.status === 'paused' || subscription.pause_at_period_end) {
    dates.push({ label: 'Resumes on', datetime: subscription.resumes_at })
  }
  if (subscription.ended_at) {
    dates.push({ label: 'Ended', datetime: subscription.ended_at })
  }
  return dates
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

  const cancellationReason = getCancellationReason(subscription)
  const cancellationComment = subscription.customer_cancellation_comment

  return (
    <>
      {/* From lg up these sit in the panel beside the page. */}
      <Box display={{ base: 'block', lg: 'none' }}>
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
                  <CatalogVersionLabel
                    organization={organization}
                    version={product ?? subscription.product}
                  />
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
          {getSubscriptionKeyDates(subscription).map(({ label, datetime }) => (
            <DetailCell
              key={label}
              label={label}
              value={
                datetime ? (
                  <Text variant="body" as="span">
                    <FormattedDateTime datetime={datetime} />
                  </Text>
                ) : (
                  <Text variant="body" as="span" color="muted">
                    Until resumed
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
          {cancellationReason && (
            <DetailCell
              label="Cancellation reason"
              value={cancellationReason}
            />
          )}
          {cancellationComment && (
            <DetailCell
              label="Cancellation comment"
              value={
                <Text variant="body" wrap="pretty">
                  {cancellationComment}
                </Text>
              }
              fullWidth
            />
          )}
        </DetailGrid>
      </Box>

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
    </>
  )
}
