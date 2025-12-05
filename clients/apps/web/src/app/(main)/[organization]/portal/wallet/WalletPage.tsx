'use client'

import { CustomerPortalWallet } from '@/components/CustomerPortal/CustomerPortalWallet'
import { schemas } from '@polar-sh/client'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

const ClientPage = ({
  organization,
  wallets,
  customerSessionToken,
}: {
  organization: schemas['CustomerOrganization']
  wallets: schemas['CustomerWallet'][]
  customerSessionToken: string
}) => {
  const wallet = wallets[0]
  return (
    <NuqsAdapter>
      {wallet && (
        <CustomerPortalWallet
          organization={organization}
          wallet={wallet}
          customerSessionToken={customerSessionToken}
        />
      )}
    </NuqsAdapter>
  )
}

export default ClientPage
