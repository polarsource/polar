import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { Payout } from '@/hooks/polar/finance'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Link } from 'expo-router'
import React from 'react'
import { StyleProp, TextStyle } from 'react-native'
import { Pill } from '../Shared/Pill'
import { Text } from '../Shared/Text'
import { Touchable } from '../Shared/Touchable'

export interface PayoutRowProps {
  payout: Payout
  showTimestamp?: boolean
  style?: StyleProp<TextStyle>
}

const statusColors = {
  pending: 'blue',
  in_transit: 'yellow',
  succeeded: 'green',
} as const

export const PayoutRow = ({ payout, style }: PayoutRowProps) => {
  const theme = useTheme()

  return (
    <Link
      href={`/finance/${payout.id}`}
      style={[
        {
          padding: theme.spacing['spacing-16'],
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: theme.borderRadii['border-radius-12'],
          gap: theme.spacing['spacing-12'],
          backgroundColor: theme.colors.card,
        },
        style,
      ]}
      asChild
    >
      <Touchable>
        <Box flex={1} flexDirection="column" gap="spacing-4">
          <Box flexDirection="row" justifyContent="space-between">
            <Text variant="bodyMedium">
              {formatCurrencyAndAmount(payout.amount, payout.currency)}
            </Text>
            <Pill color={statusColors[payout.status]}>
              {payout.status.split('_').join(' ')}
            </Pill>
          </Box>
          <Box flex={1} flexDirection="row" gap="spacing-6">
            <Text variant="bodySmall" color="subtext">
              {new Date(payout.created_at).toLocaleDateString('en-US', {
                dateStyle: 'medium',
              })}
            </Text>
          </Box>
        </Box>
      </Touchable>
    </Link>
  )
}
