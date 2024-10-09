'use client'

import { Storefront } from '@/components/Profile/Storefront'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { IssueFunding, Organization, Product } from '@polar-sh/sdk'

const ClientPage = ({
  organization,
  products,
  issues,
}: {
  organization: Organization
  products: Product[]
  issues: IssueFunding[]
}) => {
  useTrafficRecordPageView({ organization })

  return (
    <Storefront
      organization={organization}
      products={products}
      issues={issues}
    />
  )
}

export default ClientPage
