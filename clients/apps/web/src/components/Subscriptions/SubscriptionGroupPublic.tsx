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
  if (tiers.length < 1) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="flex flex-row items-center text-lg font-medium">
            <SubscriptionGroupIcon type={type} className="!h-6 !w-6" />
            <span className="dark:text-polar-50 ml-2">{title}</span>
          </h2>
        </div>
        <p className="dark:text-polar-500 mt-2 text-gray-500">{description}</p>
      </div>

      <div className="-mx-10 flex h-fit flex-row gap-6 overflow-x-auto px-10 py-6 md:mx-0 md:grid md:grid-cols-3 md:overflow-x-visible md:px-0 md:py-2">
        {tiers.map((tier) => (
          <SubscriptionTierCard
            className="self-stretch md:h-full"
            key={tier.id}
            subscriptionTier={tier}
            variant="small"
          >
            <Link
              className="flex w-full flex-col gap-y-4"
              href={{
                pathname: subscribePath,
                query: { tier: tier.id },
              }}
            >
              <Button
                className="transition-colors dark:hover:border-[--var-dark-border-color] dark:hover:bg-[--var-dark-border-color] dark:hover:text-[--var-dark-fg-color]"
                size="lg"
                variant="outline"
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
