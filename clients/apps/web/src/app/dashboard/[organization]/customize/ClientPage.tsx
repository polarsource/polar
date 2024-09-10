'use client'

import { PublicPage } from '@/components/Profile/ProfilePage'
import {
  Article,
  IssueFunding,
  Organization,
  Product,
  PublicDonation,
} from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'

export const ClientPage = ({
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
  return (
    <div className="flex flex-grow flex-col">
      <ShadowBox className="flex flex-grow flex-col">
        <PublicPage
          organization={organization}
          posts={posts}
          products={products}
          issues={issues}
          donations={donations}
        />
      </ShadowBox>
    </div>
  )
}
