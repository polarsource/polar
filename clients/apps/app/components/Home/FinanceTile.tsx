import { Box } from '@/components/Shared/Box'
import {
  useOrganizationAccount,
  useTransactionsSummary,
} from '@/hooks/polar/finance'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
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
  const { data: summary } = useTransactionsSummary(account?.id)
  const router = useRouter()

  const canWithdraw =
    account?.status === 'active' &&
    summary?.balance?.amount &&
    summary.balance.amount >= 1000

  return (
    <Tile href="/finance">
      <Box flex={1} flexDirection="column" justifyContent="space-between">
        <Box flexDirection="column" gap="spacing-4">
          <Text variant="body" color="subtext">
            Account Balance
          </Text>
          <Text
            variant="headline"
            numberOfLines={1}
            loading={loading}
            placeholderText="$1,234"
          >
            {formatCurrencyAndAmount(
              summary?.balance.amount ?? 0,
              'USD',
              0,
              undefined,
              0,
            )}
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
