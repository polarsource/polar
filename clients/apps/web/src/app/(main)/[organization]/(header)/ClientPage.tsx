'use client'

import { Storefront } from '@/components/Profile/Storefront'
import { schemas } from '@polar-sh/client'

const ClientPage = ({
  organization,
  products,
  issues,
}: {
  organization: schemas['Organization']
  products: schemas['ProductStorefront'][]
  issues: schemas['IssueFunding'][]
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
