import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import WalletCard from '../Wallet/WalletCard'

export interface CustomerPortalWalletProps {
  organization: schemas['CustomerOrganization']
  wallet: schemas['CustomerWallet']
  customerSessionToken: string
}

export const CustomerPortalWallet = ({
  organization,
  wallet,
  customerSessionToken,
}: CustomerPortalWalletProps) => {
  const api = createClientSideAPI(customerSessionToken)

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between">
        <WalletCard organization={organization} wallet={wallet} />
      </div>
    </div>
  )
}
