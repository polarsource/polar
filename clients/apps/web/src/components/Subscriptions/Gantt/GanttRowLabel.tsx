import { getMonthlyRecurringAmount } from '@/utils/subscriptionSummary'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { twMerge } from 'tailwind-merge'
import { formatRecurringSchedule } from '../SubscriptionDetailsGrid'
import { ROW_HEIGHT } from './scale'

export const formatSubscriptionPrice = (
  subscription: schemas['Subscription'],
): string =>
  `${formatCurrency('compact')(subscription.amount, subscription.currency)} ${formatRecurringSchedule(
    subscription.recurring_interval,
    subscription.recurring_interval_count,
  ).toLowerCase()}`

interface GanttRowLabelProps {
  subscription: schemas['Subscription']
  className?: string
  onHover: (id: string) => void
  onSelect: (id: string) => void
}

export const GanttRowLabel = ({
  subscription,
  className,
  onHover,
  onSelect,
}: GanttRowLabelProps) => {
  const { customer, product } = subscription
  const monthlyAmount = getMonthlyRecurringAmount(subscription)
  return (
    <div
      className={twMerge('cursor-pointer', className)}
      data-row={subscription.id}
      onMouseEnter={() => onHover(subscription.id)}
      onClick={() => onSelect(subscription.id)}
    >
      <Box height={ROW_HEIGHT} alignItems="center" columnGap="m" px="m">
        <Box flexDirection="column" flex={1} minWidth={0}>
          <Text truncate>{customer.name || customer.email || '—'}</Text>
          <Text color="muted" truncate>
            {product.name}
          </Text>
        </Box>
        <Box display={{ base: 'none', md: 'flex' }} flexShrink={0}>
          <Text
            color={monthlyAmount === null ? 'muted' : 'default'}
            tabularNums
          >
            {monthlyAmount === null
              ? '—'
              : formatCurrency('compact')(monthlyAmount, subscription.currency)}
          </Text>
        </Box>
      </Box>
    </div>
  )
}
