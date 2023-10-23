import { Add } from '@mui/icons-material'
import {
  Organization,
  SubscriptionTier,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import Link from 'next/link'
import { Button } from 'polarkit/components/ui/button'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'
import SubscriptionTierCard from './SubscriptionTierCard'

interface SubscriptionGroupProps {
  title: string
  description: string
  type: SubscriptionTierType
  tiers: SubscriptionTier[]
  organization: Organization
}

const SubscriptionGroup: React.FC<SubscriptionGroupProps> = ({
  title,
  description,
  type,
  tiers,
  organization,
}) => {
  return (
    <div className="flex flex-col gap-8 py-8">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="flex flex-row items-center text-2xl">
            <SubscriptionGroupIcon type={type} className="!h-6 !w-6" />
            <span className="dark:text-polar-50 ml-3">{title}</span>
          </h2>
          <Link
            href={{
              pathname: `/maintainer/${organization.name}/subscriptions/tiers/new`,
              query: { type },
            }}
          >
            <Button size="sm">
              <Add className="mr-2" fontSize="small" />
              New Tier
            </Button>
          </Link>
        </div>
        <p className="dark:text-polar-500 mt-4 text-gray-400">{description}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,_1fr))] gap-8">
        {tiers.map((tier) => (
          <Link
            className="transition-opacity hover:opacity-50 dark:hover:opacity-80"
            key={tier.id}
            href={`/maintainer/${organization.name}/subscriptions/tiers/${tier.id}`}
          >
            <SubscriptionTierCard
              className="h-full"
              key={tier.id}
              subscriptionTier={tier}
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default SubscriptionGroup
