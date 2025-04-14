'use client'

import { CustomerUsage } from '@/components/CustomerPortal/CustomerUsage'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'

const ClientPage = ({
  organization,
  customerSessionToken,
}: {
  organization: schemas['Organization']
  customerSessionToken?: string
}) => {
  const api = createClientSideAPI(customerSessionToken)
  return <CustomerUsage api={api} organization={organization} />
}

export default ClientPage
