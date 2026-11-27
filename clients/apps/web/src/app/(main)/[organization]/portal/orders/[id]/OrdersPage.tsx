'use client'

import CustomerPortalOrder from '@/components/CustomerPortal/CustomerPortalOrder'
import { PortalBackLink } from '@/components/CustomerPortal/PortalPrimitives'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useParams } from 'next/navigation'

const ClientPage = ({
  order,
  customerSessionToken,
}: {
  order: schemas['CustomerOrder']
  customerSessionToken: string
}) => {
  const params = useParams<{ organization: string }>()
  const api = createClientSideAPI(customerSessionToken)

  return (
    <>
      <PortalBackLink
        href={`/${params.organization}/portal/orders?customer_session_token=${customerSessionToken}`}
      >
        Orders
      </PortalBackLink>
      <CustomerPortalOrder
        api={api}
        order={order}
        customerSessionToken={customerSessionToken}
      />
    </>
  )
}

export default ClientPage
