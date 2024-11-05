'use client'

import { Storefront } from '@/components/Profile/Storefront'
import { IssueFunding, Organization, ProductStorefront } from '@polar-sh/sdk'

const ClientPage = ({
  organization,
  products,
  issues,
}: {
  organization: Organization
  products: ProductStorefront[]
  issues: IssueFunding[]
}) => {
  return (
    <Storefront
      organization={organization}
      products={products}
      issues={issues}
    />
  )
}

export default ClientPage
