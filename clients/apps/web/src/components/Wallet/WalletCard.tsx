import { schemas } from '@polar-sh/client'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'

interface WalletCardProps {
  organization: schemas['CustomerOrganization']
  wallet: schemas['CustomerWallet'] | schemas['Wallet']
}

const WalletCard = ({ organization, wallet }: WalletCardProps) => {
  return (
    <div className="dark:bg-polar-800 relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-gray-100 p-8 shadow-lg dark:border-transparent">
      {/* Content */}
      <div className="relative z-10">
        {/* Organization logo */}
        <div className="mb-4">
          {organization.avatar_url ? (
            <img
              src={organization.avatar_url}
              alt={organization.name}
              className="dark:bg-polar-700 h-12 w-12 rounded-lg border border-gray-200 bg-white object-cover p-1 dark:border-transparent"
            />
          ) : (
            <div className="dark:bg-polar-700 dark:text-polar-400 flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-semibold text-gray-600 dark:border-transparent">
              {organization.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Balance */}
        <div className="mb-2">
          <div className="dark:text-polar-400 mb-1 text-sm font-medium tracking-wider text-gray-500 uppercase">
            Available Balance
          </div>
          <div className="text-4xl font-bold tracking-tight text-gray-950 dark:text-white">
            {formatCurrencyAndAmount(wallet.balance, wallet.currency)}
          </div>
        </div>

        {/* Card footer */}
        <div className="mt-8 flex items-end justify-between">
          <div>
            <div className="dark:text-polar-400 text-xs font-medium tracking-wider text-gray-500 uppercase">
              Organization
            </div>
            <div className="text-sm font-semibold text-gray-950 dark:text-white">
              {organization.name}
            </div>
          </div>
          <div className="text-right">
            <div className="dark:text-polar-400 text-xs font-medium tracking-wider text-gray-500 uppercase">
              Currency
            </div>
            <div className="text-sm font-semibold text-gray-950 uppercase dark:text-white">
              {wallet.currency}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WalletCard
