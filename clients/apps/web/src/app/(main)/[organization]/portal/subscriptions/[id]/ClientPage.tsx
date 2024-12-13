'use client'

import CustomerPortalSubscription from '@/components/CustomerPortal/CustomerPortalSubscription'
import { buildAPI } from '@/utils/api'
import { CustomerSubscription, Organization } from '@polar-sh/sdk'

const ClientPage = ({
  subscription,
  customerSessionToken,
}: {
  organization: Organization
  subscription: CustomerSubscription
  customerSessionToken?: string
}) => {
  const api = buildAPI({ token: customerSessionToken })
  return <CustomerPortalSubscription api={api} subscription={subscription} />
}

export default ClientPage
