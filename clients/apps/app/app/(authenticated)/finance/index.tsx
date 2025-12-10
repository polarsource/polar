import { PayoutRow } from '@/components/Payouts/PayoutRow'
import { Banner } from '@/components/Shared/Banner'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { ThemedText } from '@/components/Shared/ThemedText'
import { useTheme } from '@/design-system/useTheme'
import {
  useOrganizationAccount,
  usePayouts,
  useTransactionsSummary,
} from '@/hooks/polar/finance'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Link, Stack } from 'expo-router'
import { useCallback, useContext } from 'react'
import { RefreshControl, ScrollView } from 'react-native'

export default function Finance() {
  const theme = useTheme()
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
      contentContainerStyle={{
        gap: theme.spacing['spacing-32'],
        padding: theme.spacing['spacing-16'],
        paddingBottom: theme.spacing['spacing-48'],
        backgroundColor: theme.colors.background,
      }}
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
      <Box
        flexDirection="column"
        gap="spacing-8"
        borderRadius="border-radius-16"
        padding="spacing-16"
        backgroundColor="card"
      >
        <ThemedText style={{ fontSize: 16 }} secondary>
          Account Balance
        </ThemedText>
        <ThemedText style={{ fontSize: 32 }}>
          {formatCurrencyAndAmount(summary?.balance.amount ?? 0, 'USD')}
        </ThemedText>
      </Box>
      <Box flexDirection="column" alignItems="center" gap="spacing-16">
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
      </Box>

      <Box flexDirection="column" gap="spacing-16">
        <ThemedText style={{ fontSize: 20 }}>Payouts</ThemedText>
        <Box flexDirection="column" gap="spacing-4">
          {payouts?.items?.map((payout) => (
            <PayoutRow key={payout.id} payout={payout} />
          ))}
        </Box>
      </Box>
    </ScrollView>
  )
}
