import { DetailRow, Details } from '@/components/Shared/Details'
import { usePayout } from '@/hooks/polar/finance'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Stack, useLocalSearchParams } from 'expo-router'
import React from 'react'
import { SafeAreaView, StyleSheet } from 'react-native'

export default function Index() {
  const { payoutId } = useLocalSearchParams<{ payoutId: string }>()

  const { data: payout } = usePayout(payoutId)

  return (
    <>
      <Stack.Screen options={{ title: 'Payout' }} />
      <SafeAreaView
        style={{
          flex: 1,
          flexDirection: 'column',
          gap: 16,
          justifyContent: 'space-between',
          margin: 16,
        }}
      >
        <Details>
          <DetailRow
            label="Created"
            value={
              payout?.created_at
                ? new Date(payout?.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : undefined
            }
            valueStyle={PayoutStyles.valueStyle}
          />
          <DetailRow
            label="Status"
            value={payout?.status.split('_').join(' ')}
            valueStyle={PayoutStyles.valueStyle}
          />
          <DetailRow
            label="Processor"
            value={payout?.processor}
            valueStyle={PayoutStyles.valueStyle}
          />
          <DetailRow
            label="Gross"
            value={formatCurrencyAndAmount(
              payout?.gross_amount ?? 0,
              payout?.currency,
            )}
          />
          <DetailRow
            label="Fees"
            value={formatCurrencyAndAmount(
              payout?.fees_amount ?? 0,
              payout?.currency,
            )}
          />
        </Details>
      </SafeAreaView>
    </>
  )
}

const PayoutStyles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    padding: 16,
    gap: 16,
  },
  title: {
    fontSize: 24,
  },
  valueStyle: {
    textTransform: 'capitalize',
  },
})
