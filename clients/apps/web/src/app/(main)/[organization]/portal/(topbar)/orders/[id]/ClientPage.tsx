'use client'

import CustomerPortalOrder from '@/components/CustomerPortal/CustomerPortalOrder'
import { buildAPI } from '@/utils/api'
import { CustomerOrder, Organization } from '@polar-sh/api'

const ClientPage = ({
  order,
  customerSessionToken,
}: {
  organization: Organization
  order: CustomerOrder
  customerSessionToken?: string
}) => {
  const api = buildAPI({ token: customerSessionToken })
  return <CustomerPortalOrder api={api} order={order} />
}

export default ClientPage
