'use client'

import IssuesLookingForFunding from '@/components/Organization/IssuesLookingForFunding'
import PublicSubscriptionUpsell from '@/components/Subscriptions/PublicSubscriptionUpsell'
import { Organization } from '@polar-sh/sdk'
import { useSubscriptionTiers } from 'polarkit/hooks'

const ClientPage = ({ organization }: { organization: Organization }) => {
  const { data: { items: subscriptionTiers } = { items: [] } } =
    useSubscriptionTiers(organization.name, 100)

  const highlightedTiers =
    subscriptionTiers?.filter((tier) => tier.is_highlighted) ?? []

  return (
    <div className="flex w-full flex-col gap-y-8">
      {highlightedTiers.length > 0 && (
        <PublicSubscriptionUpsell
          organization={organization}
          subscriptionTiers={highlightedTiers}
          subscribePath="/subscribe"
        />
      )}

      <div className="dark:bg-polar-900 dark:border-polar-800 flex min-h-[480px] w-full flex-col gap-y-8 rounded-3xl border border-gray-100 bg-white p-12">
        <div className="flex flex-row items-start justify-between">
          <h2 className="text-lg font-medium">Issues looking for funding</h2>
        </div>
        <IssuesLookingForFunding organization={organization} />
      </div>
    </div>
  )
}

export default ClientPage
