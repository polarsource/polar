import { SubscriptionTierSubscriber } from '@polar-sh/sdk'
import Link from 'next/link'
import { Avatar } from 'polarkit/components/ui/atoms'
import { useOrganization } from 'polarkit/hooks'
import SubscriptionGroupIcon from '../Subscriptions/SubscriptionGroupIcon'

export interface MySubscriptionsNavigationProps {
  subscriptionTiers: SubscriptionTierSubscriber[]
}

export const MySubscriptionsNavigation = ({
  subscriptionTiers,
}: MySubscriptionsNavigationProps) => {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex w-full flex-row items-center gap-x-2 px-7 pt-2">
        <div className="dark:text-polar-400 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-gray-500">
          My Subscriptions
        </div>
      </div>
      <div className="flex flex-col px-4 py-3">
        {subscriptionTiers.map((tier) => (
          <SubscriptionOrganizationItem key={tier.id} tier={tier} />
        ))}
      </div>
    </div>
  )
}

const SubscriptionOrganizationItem = ({
  tier,
}: {
  tier: SubscriptionTierSubscriber
}) => {
  const { data: organization } = useOrganization(tier.organization_id ?? '')

  return (
    <Link
      className="dark:text-polar-500 dark:hover:text-polar-50 group flex items-center justify-between rounded-lg border border-transparent px-4 py-1 text-gray-700 transition-colors hover:text-blue-500"
      href={`/${organization?.name}`}
    >
      <div className="flex flex-row items-center gap-x-3">
        <Avatar
          className="h-8 w-8 border-transparent transition-colors duration-300 group-hover:border-blue-200 dark:group-hover:border-blue-400"
          avatar_url={organization?.avatar_url}
          name={organization?.name ?? ''}
        />
        <span className="w-full truncate text-sm">{organization?.name}</span>
      </div>
      <SubscriptionGroupIcon
        className="opacity-0 group-hover:opacity-100"
        type={tier.type}
      />
    </Link>
  )
}
