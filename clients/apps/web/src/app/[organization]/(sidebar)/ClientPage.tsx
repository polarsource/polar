'use client'

import { Storefront } from '@/components/Profile/Storefront'
import { useTrafficRecordPageView } from '@/utils/traffic'
import { Article, IssueFunding, Organization, Product } from '@polar-sh/sdk'

const ClientPage = ({
  organization,
  posts,
  products,
  issues,
}: {
  organization: Organization
  posts: Article[]
  products: Product[]
  issues: IssueFunding[]
}) => {
  useTrafficRecordPageView({ organization })

  return (
    <Storefront
      organization={organization}
      posts={posts}
      products={products}
      issues={issues}
    />
  )
}

export default ClientPage
