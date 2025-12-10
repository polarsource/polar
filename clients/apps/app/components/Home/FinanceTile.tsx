import { Box } from '@/components/Shared/Box'
import {
  useOrganizationAccount,
  useTransactionsSummary,
} from '@/hooks/polar/finance'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Link } from 'expo-router'
import { useContext } from 'react'
import { StyleSheet } from 'react-native'
import { MiniButton } from '../Shared/MiniButton'
import { ThemedText } from '../Shared/ThemedText'
import { Tile } from './Tile'

export const FinanceTile = () => {
  const { organization } = useContext(OrganizationContext)
  const { data: account } = useOrganizationAccount(organization?.id)
  const { data: summary } = useTransactionsSummary(account?.id)

  const canWithdraw =
    account?.status === 'active' &&
    summary?.balance?.amount &&
    summary.balance.amount >= 1000

  return (
    <Tile href="/finance">
      <Box flex={1} flexDirection="column" justifyContent="space-between">
        <Box flexDirection="column" gap="spacing-4">
          <ThemedText style={[styles.subtitle]} secondary>
            Account Balance
          </ThemedText>
          <ThemedText style={[styles.title]} numberOfLines={1}>
            {formatCurrencyAndAmount(
              summary?.balance.amount ?? 0,
              'USD',
              0,
              undefined,
              0,
            )}
          </ThemedText>
        </Box>
        <Box flexDirection="column" gap="spacing-4">
          <Link href="/finance/withdraw" asChild>
            <MiniButton
              style={{ alignSelf: 'flex-start' }}
              disabled={!canWithdraw}
            >
              Withdraw
            </MiniButton>
          </Link>
        </Box>
      </Box>
    </Tile>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: 16,
  },
  revenueValue: {
    fontSize: 26,
  },
})
