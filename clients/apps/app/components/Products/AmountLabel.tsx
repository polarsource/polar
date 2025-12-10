import { Box } from '@/components/Shared/Box'
import { formatCurrencyAndAmount } from '@/utils/money'
import { schemas } from '@polar-sh/client'
import { useMemo } from 'react'
import { ThemedText } from '../Shared/ThemedText'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: schemas['SubscriptionRecurringInterval']
  minimumFractionDigits?: number
}

const AmountLabel = ({
  amount,
  currency,
  interval,
  minimumFractionDigits = 0,
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
      <ThemedText style={{ fontSize: 14 }}>
        {formatCurrencyAndAmount(amount, currency, minimumFractionDigits)}
      </ThemedText>
      <ThemedText style={{ fontSize: 8 }}>{intervalDisplay}</ThemedText>
    </Box>
  )
}

export default AmountLabel
