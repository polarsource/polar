'use client'

import { CustomerPortalWallet } from '@/components/CustomerPortal/CustomerPortalWallet'
import { schemas } from '@polar-sh/client'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

const ClientPage = ({
  organization,
  wallets,
}: {
  organization: schemas['CustomerOrganization']
  wallets: schemas['CustomerWallet'][]
}) => {
  const wallet = wallets[0]
  return (
    <NuqsAdapter>
      {wallet && (
        <CustomerPortalWallet organization={organization} wallet={wallet} />
      )}
    </NuqsAdapter>
  )
}

export default ClientPage
