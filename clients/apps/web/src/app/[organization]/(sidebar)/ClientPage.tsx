'use client'

import { PublicPage } from '@/components/Profile/ProfilePage'
import { useTrafficRecordPageView } from '@/utils/traffic'
import {
  Article,
  IssueFunding,
  Organization,
  Product,
  PublicDonation,
} from '@polar-sh/sdk'

const ClientPage = ({
  organization,
  posts,
  products,
  issues,
  donations,
}: {
  organization: Organization
  posts: Article[]
  products: Product[]
  issues: IssueFunding[]
  donations: PublicDonation[]
}) => {
  useTrafficRecordPageView({ organization })

  return (
    <PublicPage
      organization={organization}
      posts={posts}
      products={products}
      issues={issues}
      donations={donations}
    />
  )
}

export default ClientPage
