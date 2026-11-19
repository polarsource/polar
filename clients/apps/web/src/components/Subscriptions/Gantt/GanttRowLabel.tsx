import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { twMerge } from 'tailwind-merge'
import { ROW_HEIGHT } from './scale'

export const formatSubscriptionPrice = ({
  amount,
  currency,
  recurring_interval: interval,
  recurring_interval_count: count,
}: schemas['Subscription']): string =>
  `${formatCurrency('compact')(amount, currency)} /${count > 1 ? `${count} ${interval}s` : interval}`

interface GanttRowLabelProps {
  subscription: schemas['Subscription']
  className?: string
  onSelect: (id: string) => void
}

export const GanttRowLabel = ({
  subscription,
  className,
  onSelect,
}: GanttRowLabelProps) => {
  const { customer, product } = subscription
  return (
    <div
      className={twMerge('cursor-pointer', className)}
      data-row={subscription.id}
      onClick={() => onSelect(subscription.id)}
    >
      <Box height={ROW_HEIGHT} alignItems="center" gap="s" px="l" minWidth={0}>
        <Box minWidth={0}>
          <Text truncate>{customer.name || customer.email || '—'}</Text>
        </Box>
        <Box flexShrink={0} maxWidth="45%">
          <Text color="muted" truncate>
            {product.name}
          </Text>
        </Box>
      </Box>
    </div>
  )
}
