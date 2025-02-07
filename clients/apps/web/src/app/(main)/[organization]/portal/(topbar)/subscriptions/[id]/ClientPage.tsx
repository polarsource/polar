'use client'

import CustomerPortalSubscription from '@/components/CustomerPortal/CustomerPortalSubscription'
import { createClientSideAPI } from '@/utils/client'
import { components } from '@polar-sh/client'

const ClientPage = ({
  subscription,
  customerSessionToken,
}: {
  organization: components['schemas']['Organization']
  subscription: components['schemas']['CustomerSubscription']
  customerSessionToken?: string
}) => {
  const api = createClientSideAPI(customerSessionToken)
  return <CustomerPortalSubscription api={api} subscription={subscription} />
}

export default ClientPage
