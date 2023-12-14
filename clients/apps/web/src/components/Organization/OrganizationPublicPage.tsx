'use client'

import {
  Article,
  Organization,
  Repository,
  SubscriptionSummary,
  SubscriptionTier,
} from '@polar-sh/sdk'
import { OrganizationPublicPageContent } from './OrganizationPublicPageNav'

const OrganizationPublicPage = ({
  posts,
  organization,
  repositories,
  subscriptionTiers,
}: {
  posts: Article[]
  organization: Organization
  repositories: Repository[]
  subscriptionTiers: SubscriptionTier[]
  subscriptionSummary: SubscriptionSummary[]
}) => {
  return (
    <OrganizationPublicPageContent
      organization={organization}
      posts={posts}
      repositories={repositories}
      subscriptionTiers={subscriptionTiers}
    />
  )
}

export default OrganizationPublicPage
