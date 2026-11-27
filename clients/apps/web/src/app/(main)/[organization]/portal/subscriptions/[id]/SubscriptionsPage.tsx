'use client'

import CustomerPortalSubscription from '@/components/CustomerPortal/CustomerPortalSubscription'
import { PortalBackLink } from '@/components/CustomerPortal/PortalPrimitives'
import { createClientSideAPI } from '@/utils/client'
import { schemas } from '@polar-sh/client'
import { useParams, useSearchParams } from 'next/navigation'

const ClientPage = ({
  subscription,
  products,
  customerSessionToken,
}: {
  subscription: schemas['CustomerSubscription']
  products: schemas['CustomerProduct'][]
  customerSessionToken: string
}) => {
  const params = useParams<{ organization: string }>()
  const searchParams = useSearchParams()
  const api = createClientSideAPI(customerSessionToken)
  return (
    <>
      <PortalBackLink
        href={`/${params.organization}/portal/overview?${searchParams.toString()}`}
      >
        Overview
      </PortalBackLink>
      <CustomerPortalSubscription
        api={api}
        customerSessionToken={customerSessionToken}
        subscription={subscription}
        products={products}
      />
    </>
  )
}

export default ClientPage
