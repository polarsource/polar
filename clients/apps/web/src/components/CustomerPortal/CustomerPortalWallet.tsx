import { schemas } from '@polar-sh/client'
import { Box } from '@polar-sh/orbit/Box'
import WalletCard from '../Wallet/WalletCard'

export interface CustomerPortalWalletProps {
  organization: schemas['CustomerOrganization']
  wallet: schemas['CustomerWallet']
}

export const CustomerPortalWallet = ({
  organization,
  wallet,
}: CustomerPortalWalletProps) => {
  return (
    <Box flexDirection="column" rowGap="l">
      <Box alignItems="center" justifyContent="between">
        <WalletCard organization={organization} wallet={wallet} />
      </Box>
    </Box>
  )
}
