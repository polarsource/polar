import {
  useOrganizationAccount,
  useTransactionsSummary,
} from '@/hooks/polar/finance'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Link } from 'expo-router'
import { useContext } from 'react'
import { StyleSheet, View } from 'react-native'
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
      <View
        style={{
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'column', gap: 4 }}>
          <ThemedText style={[styles.subtitle]} secondary>
            Account Balance
          </ThemedText>
          <ThemedText style={[styles.title]}>
            {formatCurrencyAndAmount(summary?.balance.amount ?? 0, 'USD')}
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'column', gap: 4 }}>
          <Link href="/finance/withdraw" asChild>
            <MiniButton
              style={{ alignSelf: 'flex-start' }}
              disabled={!canWithdraw}
            >
              Withdraw
            </MiniButton>
          </Link>
        </View>
      </View>
    </Tile>
  )
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 16,
  },
  revenueValue: {
    fontSize: 26,
  },
})
