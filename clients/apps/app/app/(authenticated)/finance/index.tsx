import { PayoutRow } from '@/components/Payouts/PayoutRow'
import { Banner } from '@/components/Shared/Banner'
import { Box } from '@/components/Shared/Box'
import { Button } from '@/components/Shared/Button'
import { EmptyState } from '@/components/Shared/EmptyState'
import { Text } from '@/components/Shared/Text'
import { useTheme } from '@/design-system/useTheme'
import {
  useOrganizationAccount,
  usePayouts,
  useTransactionsSummary,
} from '@/hooks/polar/finance'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useContext } from 'react'
import { RefreshControl, ScrollView } from 'react-native'

export default function Finance() {
  const router = useRouter()
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

  if (!account) {
    return (
      <>
        <Stack.Screen options={{ title: 'Finance' }} />
        <ScrollView
          contentContainerStyle={{
            gap: theme.spacing['spacing-32'],
            padding: theme.spacing['spacing-16'],
            paddingBottom: theme.spacing['spacing-48'],
            backgroundColor: theme.colors.background,
          }}
        >
          <EmptyState
            title="No Payout Account"
            description="This organization does not have a payout account connected."
          />
        </ScrollView>
      </>
    )
  }

  if (!summary) {
    return (
      <>
        <Stack.Screen options={{ title: 'Finance' }} />
        <ScrollView
          contentContainerStyle={{
            gap: theme.spacing['spacing-32'],
            padding: theme.spacing['spacing-16'],
            paddingBottom: theme.spacing['spacing-48'],
            backgroundColor: theme.colors.background,
          }}
        >
          <EmptyState
            title="No Financial Balance"
            description="Could not find a financial balance for this organization."
          />
        </ScrollView>
      </>
    )
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
      {!account?.is_payouts_enabled ? (
        <Banner
          title="No Payout Account"
          description="This organization does not have a payout account connected."
        />
      ) : null}
      <Box
        flexDirection="column"
        gap="spacing-8"
        borderRadius="border-radius-16"
        padding="spacing-16"
        backgroundColor="card"
      >
        <Text color="subtext">Account Balance</Text>
        <Text variant="headlineLarge">
          {formatCurrencyAndAmount(summary?.balance.amount ?? 0, 'USD')}
        </Text>
      </Box>
      <Box flexDirection="column" alignItems="center" gap="spacing-16">
        <Box width="100%">
          <Button
            onPress={() => router.push('/finance/withdraw')}
            disabled={!canWithdraw}
          >
            Withdraw
          </Button>
        </Box>
        <Text color="subtext">You may only withdraw amounts above $10.</Text>
      </Box>

      <Box flexDirection="column" gap="spacing-16">
        <Text variant="title">Payouts</Text>
        <Box flexDirection="column" gap="spacing-4">
          {payouts?.items?.map((payout) => (
            <PayoutRow key={payout.id} payout={payout} />
          ))}
        </Box>
      </Box>
    </ScrollView>
  )
}
