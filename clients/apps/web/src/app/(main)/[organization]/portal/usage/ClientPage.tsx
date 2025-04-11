'use client'

import { CustomerUsage } from '@/components/CustomerPortal/CustomerUsage'
import { createClientSideAPI } from '@/utils/client'

const ClientPage = ({
  customerSessionToken,
}: {
  customerSessionToken?: string
}) => {
  const api = createClientSideAPI(customerSessionToken)
  return <CustomerUsage api={api} />
}

export default ClientPage
