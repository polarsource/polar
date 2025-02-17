'use client'

import CustomerPortalSubscription from '@/components/CustomerPortal/CustomerPortalSubscription'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'

const ClientPage = ({
  subscription,
  products,
  customerSessionToken,
}: {
  organization: schemas['Organization']
  products: schemas['CustomerProduct'][]
  subscription: schemas['CustomerSubscription']
  customerSessionToken?: string
}) => {
  const api = createClientSideAPI(customerSessionToken)
  return (
    <CustomerPortalSubscription
      api={api}
      subscription={subscription}
      products={products}
    />
  )
}

export default ClientPage
