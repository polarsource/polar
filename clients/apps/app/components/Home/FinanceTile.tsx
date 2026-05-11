import { Box } from '@/components/Shared/Box'
import {
  useOrganizationAccount,
  usePayoutAccount,
  useTransactionsSummary,
} from '@/hooks/polar/finance'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrency } from '@polar-sh/currency'
import { useRouter } from 'expo-router'
import { useContext } from 'react'
import { Button } from '../Shared/Button'
import { Text } from '../Shared/Text'
import { Tile } from './Tile'

export interface FinanceTileProps {
  loading?: boolean
}

export const FinanceTile = ({ loading }: FinanceTileProps) => {
  const { organization } = useContext(OrganizationContext)
  const { data: account } = useOrganizationAccount(organization?.id)
  const { data: payoutAccount } = usePayoutAccount(
    organization?.payout_account_id || undefined,
  )
  const { data: summary } = useTransactionsSummary(account?.id)
  const router = useRouter()

  const canWithdraw =
    payoutAccount &&
    payoutAccount.is_payout_ready &&
    summary?.available_balance?.amount &&
    summary.available_balance.amount >= 1000
  const availableBalance = formatCurrency('compact')(
    summary?.available_balance.amount ?? 0,
    summary?.available_balance.currency ?? 'usd',
  )

  return (
    <Tile href="/finance">
      <Box flex={1} flexDirection="column" justifyContent="space-between">
        <Box flexDirection="column" gap="spacing-4">
          <Text variant="body" color="subtext">
            Available balance
          </Text>
          <Text
            variant="headline"
            numberOfLines={1}
            loading={loading}
            placeholderText="$1,234"
          >
            {availableBalance}
          </Text>
        </Box>
        <Box flexDirection="row" justifyContent="flex-start">
          <Button
            size="small"
            disabled={!canWithdraw}
            onPress={() => router.push('/finance/withdraw')}
          >
            Withdraw
          </Button>
        </Box>
      </Box>
    </Tile>
  )
}
