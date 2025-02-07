'use client'

import { Storefront } from '@/components/Profile/Storefront'
import { components } from '@polar-sh/client'

const ClientPage = ({
  organization,
  products,
  issues,
}: {
  organization: components['schemas']['Organization']
  products: components['schemas']['ProductStorefront'][]
  issues: components['schemas']['IssueFunding'][]
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
