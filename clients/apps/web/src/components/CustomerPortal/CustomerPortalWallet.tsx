import { schemas } from '@polar-sh/client'
import { formatCurrency } from '@polar-sh/currency'
import { Text } from '@polar-sh/orbit'
import { Box } from '@polar-sh/orbit/Box'
import {
  PortalCard,
  PortalPageHeader,
  PortalRow,
  PortalRows,
  PortalText,
} from './PortalPrimitives'

export interface CustomerPortalWalletProps {
  organization: schemas['CustomerOrganization']
  wallet: schemas['CustomerWallet']
}

export const CustomerPortalWallet = ({
  organization,
  wallet,
}: CustomerPortalWalletProps) => {
  return (
    <>
      <PortalPageHeader
        title="Wallet"
        description={`Credit available for purchases from ${organization.name}`}
      />
      <PortalCard rowGap="2xl">
        <Box flexDirection="column" rowGap="xs">
          <PortalText tone="secondary" className="text-sm">
            Available balance
          </PortalText>
          <Text variant="heading-m" as="p" tabularNums>
            {formatCurrency('compact')(wallet.balance, wallet.currency)}
          </Text>
        </Box>
        <PortalRows>
          <PortalRow label="Currency" value={wallet.currency.toUpperCase()} />
        </PortalRows>
      </PortalCard>
    </>
  )
}
