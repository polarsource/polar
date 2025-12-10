import { Box } from '@/components/Shared/Box'
import { useTheme } from '@/design-system/useTheme'
import { Payout } from '@/hooks/polar/finance'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Link } from 'expo-router'
import React from 'react'
import { StyleProp, TextStyle, TouchableOpacity } from 'react-native'
import { Pill } from '../Shared/Pill'
import { ThemedText } from '../Shared/ThemedText'

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
      <TouchableOpacity activeOpacity={0.6}>
        <Box flex={1} flexDirection="column" gap="spacing-4">
          <Box flexDirection="row" justifyContent="space-between">
            <ThemedText style={{ fontSize: 16, fontWeight: '500' }}>
              {formatCurrencyAndAmount(payout.amount, payout.currency)}
            </ThemedText>
            <Pill color={statusColors[payout.status]}>
              {payout.status.split('_').join(' ')}
            </Pill>
          </Box>
          <Box flex={1} flexDirection="row" gap="spacing-6">
            <ThemedText style={{ fontSize: 14 }} secondary>
              {new Date(payout.created_at).toLocaleDateString('en-US', {
                dateStyle: 'medium',
              })}
            </ThemedText>
          </Box>
        </Box>
      </TouchableOpacity>
    </Link>
  )
}
