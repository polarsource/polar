import { Payout } from '@/hooks/polar/finance'
import { useTheme } from '@/hooks/theme'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Link } from 'expo-router'
import React from 'react'
import {
  StyleProp,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native'
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
  const { colors } = useTheme()

  return (
    <Link
      href={`/finance/${payout.id}`}
      style={[styles.container, { backgroundColor: colors.card }, style]}
      asChild
    >
      <TouchableOpacity activeOpacity={0.6}>
        <View style={styles.contentContainer}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <ThemedText style={styles.amount}>
              {formatCurrencyAndAmount(payout.amount, payout.currency)}
            </ThemedText>
            <Pill color={statusColors[payout.status]}>
              {payout.status.split('_').join(' ')}
            </Pill>
          </View>
          <View style={styles.metadataContainer}>
            <ThemedText style={styles.date} secondary>
              {new Date(payout.created_at).toLocaleDateString('en-US', {
                dateStyle: 'medium',
              })}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    gap: 12,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: '500',
  },
  metadataContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  date: {
    fontSize: 14,
  },
})
