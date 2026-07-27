import { schemas } from '@polar-sh/client'
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
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-row items-center justify-between">
        <WalletCard organization={organization} wallet={wallet} />
      </div>
    </div>
  )
}
