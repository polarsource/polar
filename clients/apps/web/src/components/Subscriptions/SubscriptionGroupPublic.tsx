import { SubscriptionTier, SubscriptionTierType } from '@polar-sh/sdk'
import Link from 'next/link'
import { Button } from 'polarkit/components/ui/atoms'
import SubscriptionGroupIcon from './SubscriptionGroupIcon'
import SubscriptionTierCard from './SubscriptionTierCard'

interface SubscriptionGroupPublicProps {
  title: string
  description: string
  type: SubscriptionTierType
  tiers: SubscriptionTier[]
  subscribePath: string
}

const SubscriptionGroupPublic = ({
  title,
  description,
  type,
  tiers,
  subscribePath,
}: SubscriptionGroupPublicProps) => {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="flex flex-row items-center text-2xl">
            <SubscriptionGroupIcon type={type} className="!h-6 !w-6" />
            <span className="dark:text-polar-50 ml-3">{title}</span>
          </h2>
        </div>
        <p className="dark:text-polar-500 mt-4 text-gray-400">{description}</p>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {tiers.map((tier) => (
          <SubscriptionTierCard
            className="h-full"
            key={tier.id}
            subscriptionTier={tier}
          >
            <Link
              className="w-full"
              href={{
                pathname: subscribePath,
                query: { tier: tier.id },
              }}
            >
              <Button
                classNames="bg-[--var-border-color] hover:bg-[--var-border-color] dark:bg-[--var-dark-border-color] text-[--var-fg-color] dark:text-[--var-dark-fg-color] transition-colors hover:text-white dark:hover:text-white"
                fullWidth
              >
                Subscribe
              </Button>
            </Link>
          </SubscriptionTierCard>
        ))}
      </div>
    </div>
  )
}

export default SubscriptionGroupPublic
