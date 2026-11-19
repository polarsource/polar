import { Field } from '@/components/Events/EventDetailField'
import { IconButton, Section } from '@/components/Events/EventDetailPanel'
import { buildCustomerDashboardPath } from '@/utils/customer'
import { getDiscountDisplay } from '@/utils/discount'
import {
  getSubscriptionActivity,
  type SubscriptionActivityKind,
} from '@/utils/subscriptionSummary'
import { schemas } from '@polar-sh/client'
import { Button, Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  FlaskConical,
  Plus,
  RefreshCw,
  X,
} from '@polar-sh/orbit/icons'
import { format } from 'date-fns'
import Link from 'next/link'
import { useState } from 'react'
import { formatSubscriptionPrice } from './Gantt/GanttRowLabel'
import { SubscriptionStatus } from './SubscriptionStatus'

const ACTIVITY_ICONS: Record<SubscriptionActivityKind, typeof Clock> = {
  started: Plus,
  trial: FlaskConical,
  converted: CircleCheck,
  renewal: RefreshCw,
  failed: CircleAlert,
  canceled: CircleX,
  paused: CircleDashed,
  ended: CircleX,
  scheduled: Clock,
}

const ACTIVITY_ROW_HEIGHT = 40
const ACTIVITY_ICON_SIZE = 14
const ACTIVITY_LINE_GAP = 7

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
  const { customer, product, discount } = subscription
  const activity = getSubscriptionActivity(subscription, now)

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

      <Box flexDirection="column" paddingHorizontal="l" paddingVertical="m">
        <Field label="Status">
          <Text as="div">
            <SubscriptionStatus subscription={subscription} />
          </Text>
        </Field>
        {customer.email && (
          <Field label="Email" copyValue={customer.email}>
            <Text truncate>{customer.email}</Text>
          </Field>
        )}
        <Field label="Product">
          <Text truncate>{product.name}</Text>
        </Field>
        <Field label="Price">
          <Text tabularNums>{formatSubscriptionPrice(subscription)}</Text>
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

      <Section title="Activity">
        <Box flexDirection="column">
          {activity.map(({ kind, label, at, upcoming }, index) => {
            const Icon = upcoming ? Clock : ACTIVITY_ICONS[kind]
            return (
              <Box
                key={`${label}-${at}`}
                alignItems="center"
                gap="s"
                position="relative"
                height={ACTIVITY_ROW_HEIGHT}
              >
                {index < activity.length - 1 && (
                  <Box
                    position="absolute"
                    left={ACTIVITY_ICON_SIZE / 2 - 0.5}
                    top={
                      (ACTIVITY_ROW_HEIGHT + ACTIVITY_ICON_SIZE) / 2 +
                      ACTIVITY_LINE_GAP
                    }
                    height={
                      ACTIVITY_ROW_HEIGHT -
                      ACTIVITY_ICON_SIZE -
                      ACTIVITY_LINE_GAP * 2
                    }
                    borderLeftWidth={1}
                    borderStyle="solid"
                    borderColor="border-primary"
                  />
                )}
                <Icon className="dark:text-polar-500 h-3.5 w-3.5 shrink-0 text-gray-400" />
                <Box flexGrow={1} minWidth={0}>
                  <Text color={upcoming ? 'muted' : 'default'} truncate>
                    {label}
                  </Text>
                </Box>
                <Box flexShrink={0}>
                  <Text color="muted" tabularNums>
                    {formatDate(at)}
                  </Text>
                </Box>
              </Box>
            )
          })}
        </Box>
      </Section>

      <Box
        gap="s"
        paddingHorizontal="l"
        paddingVertical="l"
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Link
          href={buildCustomerDashboardPath(organization.slug, customer)}
          className="flex-1"
        >
          <Button variant="secondary" fullWidth>
            View customer
          </Button>
        </Link>
        <Link
          href={`/dashboard/${organization.slug}/sales/subscriptions/${subscription.id}`}
          className="flex-1"
        >
          <Button fullWidth>Manage</Button>
        </Link>
      </Box>
    </div>
  )
}
