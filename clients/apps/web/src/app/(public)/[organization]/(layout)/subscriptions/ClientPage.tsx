'use client'

import OrganizationSubscriptionsPublicPage from '@/components/Subscriptions/OrganizationSubscriptionsPublicPage'
import { Organization } from '@polar-sh/sdk'
import { useSubscriptionTiers } from 'polarkit/hooks'

const ClientPage = ({ organization }: { organization: Organization }) => {
  const { data: { items: subscriptionTiers = [] } = { items: [] } } =
    useSubscriptionTiers(organization.name, 100)

  return (
    <OrganizationSubscriptionsPublicPage
      organization={organization}
      subscriptionTiers={subscriptionTiers}
    />
  )
}

export default ClientPage
