'use client'

import { CustomerUsage } from '@/components/CustomerPortal/CustomerUsage'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'

const ClientPage = ({
  customerSessionToken,
}: {
  organization: schemas['CustomerOrganization']
  customerSessionToken?: string
}) => {
  const api = createClientSideAPI(customerSessionToken)
  return <CustomerUsage api={api} />
}

export default ClientPage
