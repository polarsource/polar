import { Field } from '@/components/Events/EventDetailField'
import { IconButton, Section } from '@/components/Events/EventDetailPanel'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { getDiscountDisplay } from '@/utils/discount'
import { getSubscriptionActivity } from '@/utils/subscriptionSummary'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { ChevronDown, ChevronUp, X } from '@polar-sh/orbit/icons'
import { format } from 'date-fns'
import Link from 'next/link'
import { useState } from 'react'
import { SubscriptionActivityList } from './SubscriptionActivityList'
import { SubscriptionSummary } from './SubscriptionSummary'
import { useSubscriptionDunning } from './useSubscriptionDunning'

const CUSTOMER_LINK_CLASS = 'min-w-0 truncate hover:underline'

const formatDate = (value: string | number): string =>
  format(new Date(value), 'MMM d, yyyy')

interface SubscriptionDetailPanelProps {
  subscription: schemas['Subscription']
  organization: schemas['Organization']
  onPrevious?: () => void
  onNext?: () => void
  onClose: () => void
}

const formatDiscountDuration = (
  discount: NonNullable<schemas['Subscription']['discount']>,
): string => {
  if (discount.duration === 'forever') return 'forever'
  if (discount.duration === 'once') return 'once'
  if (!('duration_in_months' in discount)) return ''
  const months = discount.duration_in_months
  return months === 1 ? 'for 1 month' : `for ${months} months`
}

export const SubscriptionDetailPanel = ({
  subscription,
  organization,
  onPrevious,
  onNext,
  onClose,
}: SubscriptionDetailPanelProps) => {
  const [now] = useState(() => Date.now())
  const { customer, discount } = subscription
  const dunning = useSubscriptionDunning(organization.id, subscription.id)
  const activity = getSubscriptionActivity(subscription, now, dunning)

  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white lg:static lg:z-auto lg:w-[400px] lg:shrink-0 lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-xs">
      <Box
        alignItems="center"
        justifyContent="between"
        gap="s"
        paddingLeft="l"
        paddingRight="m"
        paddingVertical="m"
      >
        <Box minWidth={0}>
          <Text variant="body" truncate>
            {customer.name || customer.email || '—'}
          </Text>
        </Box>
        <Box alignItems="center" flexShrink={0}>
          <IconButton
            label="Previous subscription"
            onClick={onPrevious}
            disabled={!onPrevious}
          >
            <ChevronUp className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Next subscription"
            onClick={onNext}
            disabled={!onNext}
          >
            <ChevronDown className="h-4 w-4" />
          </IconButton>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </Box>
      </Box>

      <SubscriptionSummary
        subscription={subscription}
        organization={organization}
      />

      <Box flexDirection="column" paddingHorizontal="l" paddingVertical="m">
        <Field label="Customer">
          <Link
            href={buildCustomerDashboardPath(organization.slug, customer)}
            className={CUSTOMER_LINK_CLASS}
          >
            <Text truncate>{customer.name || customer.email || '—'}</Text>
          </Link>
        </Field>
        {discount && (
          <Field label="Discount">
            <Box alignItems="center" gap="s" minWidth={0}>
              <Text truncate>{discount.name}</Text>
              <Text color="muted" wrap="nowrap" tabularNums>
                {getDiscountDisplay(discount)}{' '}
                {formatDiscountDuration(discount)}
              </Text>
            </Box>
          </Field>
        )}
        <Field label="Since">
          <Text tabularNums>{formatDate(subscription.started_at)}</Text>
        </Field>
        {!subscription.ended_at && (
          <Field label="Period">
            <Text tabularNums truncate>
              {formatDate(subscription.current_period_start)} to{' '}
              {formatDate(subscription.current_period_end)}
            </Text>
          </Field>
        )}
        <Field label="ID" copyValue={subscription.id}>
          <Text truncate monospace>
            {subscription.id}
          </Text>
        </Field>
      </Box>

      <Box paddingHorizontal="l" paddingTop="s" paddingBottom="l">
        <Link
          href={`/dashboard/${organization.slug}/sales/subscriptions/${subscription.id}`}
          className="flex-1"
        >
          <Button fullWidth>Manage</Button>
        </Link>
      </Box>

      <Section title="Activity">
        <SubscriptionActivityList activity={activity} />
      </Section>
    </div>
  )
}
