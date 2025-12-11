import { Box } from '@/components/Shared/Box'
import {
  useOrganizationAccount,
  useTransactionsSummary,
} from '@/hooks/polar/finance'
import { OrganizationContext } from '@/providers/OrganizationProvider'
import { formatCurrencyAndAmount } from '@/utils/money'
import { Link } from 'expo-router'
import { useContext } from 'react'
import { MiniButton } from '../Shared/MiniButton'
import { Text } from '../Shared/Text'
import { Tile } from './Tile'

export interface FinanceTileProps {
  loading?: boolean
}

export const FinanceTile = ({ loading }: FinanceTileProps) => {
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
