'use client'

import { PublicPage } from '@/components/Profile/PublicPage'
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
    <PublicPage
      organization={organization}
      posts={posts}
      products={products}
      issues={issues}
    />
  )
}

export default ClientPage
