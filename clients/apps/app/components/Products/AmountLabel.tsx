import { Box } from '@/components/Shared/Box'
import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { useMemo } from 'react'
import { Text } from '../Shared/Text'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: schemas['SubscriptionRecurringInterval']
  minimumFractionDigits?: number
  loading?: boolean
}

const AmountLabel = ({
  amount,
  currency,
  interval,
  minimumFractionDigits = 0,
  loading,
}: AmountLabelProps) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return ''
    }
    switch (interval) {
      case 'month':
        return ' / mo'
      case 'year':
        return ' / yr'
      default:
        return ''
    }
  }, [interval])

  return (
    <Box flexDirection="row" alignItems="baseline">
      <Text loading={loading} variant="bodySmall">
        {formatCurrency(amount, currency, minimumFractionDigits)}
      </Text>
      <Text variant="captionSmall">{intervalDisplay}</Text>
    </Box>
  )
}

export default AmountLabel
