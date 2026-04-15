'use client'

import CustomerPortalSubscription from '@/components/CustomerPortal/CustomerPortalSubscription'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'

const ClientPage = ({
  subscription,
  products,
  customerSessionToken,
}: {
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
  customerSessionToken: string
}) => {
  const api = createClientSideAPI(customerSessionToken)
  return (
    <CustomerPortalSubscription
      api={api}
      customerSessionToken={customerSessionToken}
      subscription={subscription}
      products={products}
    />
  )
}

export default ClientPage
