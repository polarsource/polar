import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import { CatalogVersionLabel } from '@/components/Products/CatalogVersionLabel'
import { SubscriptionStatus } from './SubscriptionStatus'

// What is being paid, and the state it is in.
export const SubscriptionSummary = ({
  subscription,
  organization,
}: {
  subscription: schemas['Subscription']
  organization: schemas['Organization']
}) => {
  const {
    amount,
    currency,
    recurring_interval: interval,
    recurring_interval_count: count,
    product,
  } = subscription

  return (
    <Box
      alignItems="start"
      justifyContent="between"
      gap="m"
      paddingHorizontal="l"
      py="m"
    >
      <Box flexDirection="column" gap="xs" minWidth={0}>
        <Box alignItems="baseline" gap="s">
          <Text variant="heading-xs" tabularNums>
            {formatCurrency('compact')(amount, currency)}
          </Text>
          <Text color="muted" wrap="nowrap">
            per {count > 1 ? `${count} ${interval}s` : interval}
          </Text>
        </Box>
        <Box alignItems="center" gap="s" minWidth={0}>
          <Text color="muted" truncate>
            {product.name}
          </Text>
          <CatalogVersionLabel organization={organization} version={product} />
        </Box>
      </Box>
      <Box flexShrink={0}>
        <Text as="div">
          <SubscriptionStatus subscription={subscription} />
        </Text>
      </Box>
    </Box>
  )
}
