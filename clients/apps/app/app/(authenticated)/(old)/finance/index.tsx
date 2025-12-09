import { PayoutRow } from '@/components/Payouts/PayoutRow'
import { Banner } from '@/components/Shared/Banner'
import { Button } from '@/components/Shared/Button'
import { ThemedText } from '@/components/Shared/ThemedText'
import {
  useOrganizationAccount,
  usePayouts,
  useTransactionsSummary,
} from '@/hooks/polar/finance'
import { useTheme } from '@/hooks/theme'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Link, Stack } from 'expo-router'
import { useCallback, useContext } from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'

export default function Finance() {
  const { colors } = useTheme()
  const { organization } = useContext(OrganizationContext)
  const {
    data: account,
    refetch: refetchAccount,
    isRefetching: isRefetchingAccount,
  } = useOrganizationAccount(organization?.id)

  const {
    data: summary,
    refetch: refetchSummary,
    isRefetching: isRefetchingSummary,
  } = useTransactionsSummary(account?.id)

  const {
    data: payouts,
    isRefetching: isRefetchingPayouts,
    refetch: refetchPayouts,
  } = usePayouts()

  const refresh = useCallback(() => {
    Promise.all([refetchAccount(), refetchSummary(), refetchPayouts()])
  }, [refetchAccount, refetchSummary, refetchPayouts])

  const isRefetching =
    isRefetchingAccount || isRefetchingSummary || isRefetchingPayouts

  const canWithdraw =
    account?.status === 'active' &&
    summary?.balance?.amount &&
    summary.balance.amount >= 1000

  if (!account || !summary) {
    return <Stack.Screen options={{ title: 'Finance' }} />
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
      refreshControl={
        <RefreshControl onRefresh={refresh} refreshing={isRefetching} />
      }
    >
      <Stack.Screen options={{ title: 'Finance' }} />
      {!account?.is_payouts_enabled && (
        <Banner
          title="No Payout Account"
          description="This organization does not have a payout account connected."
        />
      )}
      <View style={[styles.balanceContainer, { backgroundColor: colors.card }]}>
        <ThemedText style={styles.balanceLabel} secondary>
          Account Balance
        </ThemedText>
        <ThemedText style={styles.balance}>
          {formatCurrencyAndAmount(summary?.balance.amount ?? 0, 'USD')}
        </ThemedText>
      </View>
      <View style={{ flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <Link
          style={{ width: '100%' }}
          href="/finance/withdraw"
          disabled={!canWithdraw}
          asChild
        >
          <Button>Withdraw</Button>
        </Link>
        <ThemedText secondary>
          You may only withdraw amounts above $10.
        </ThemedText>
      </View>

      <View style={{ flexDirection: 'column', gap: 16 }}>
        <ThemedText style={{ fontSize: 20 }}>Payouts</ThemedText>
        <View style={{ flexDirection: 'column', gap: 4 }}>
          {payouts?.items?.map((payout) => (
            <PayoutRow key={payout.id} payout={payout} />
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 32,
    padding: 16,
    paddingBottom: 48,
  },
  balanceContainer: {
    flexDirection: 'column',
    gap: 8,
    borderRadius: 16,
    padding: 16,
  },
  balanceLabel: {
    fontSize: 16,
  },
  balance: {
    fontSize: 32,
  },
})
