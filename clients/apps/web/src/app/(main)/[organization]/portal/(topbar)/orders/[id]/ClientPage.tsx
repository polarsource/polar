'use client'

import CustomerPortalOrder from '@/components/CustomerPortal/CustomerPortalOrder'
import { createClientSideAPI } from '@/utils/client'
import { components } from '@polar-sh/client'

const ClientPage = ({
  order,
  customerSessionToken,
}: {
  organization: components['schemas']['Organization']
  order: components['schemas']['CustomerOrder']
  customerSessionToken?: string
}) => {
  const api = createClientSideAPI(customerSessionToken)
  return <CustomerPortalOrder api={api} order={order} />
}

export default ClientPage
