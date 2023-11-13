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
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="flex flex-row items-center text-xl">
            <SubscriptionGroupIcon type={type} className="!h-6 !w-6" />
            <span className="dark:text-polar-50 ml-2">{title}</span>
          </h2>
        </div>
        <p className="dark:text-polar-500 mt-4 text-gray-400">{description}</p>
      </div>
      <div className="-mx-10 flex h-fit gap-6 overflow-x-auto px-10 py-6 md:mx-0 md:overflow-x-visible md:px-0 ">
        {tiers.map((tier) => (
          <SubscriptionTierCard
            className="h-full self-stretch"
            key={tier.id}
            subscriptionTier={tier}
            variant="small"
          >
            <Link
              className="w-full"
              href={{
                pathname: subscribePath,
                query: { tier: tier.id },
              }}
            >
              <Button
                size="lg"
                className="bg-[--var-border-color] text-[--var-fg-color] transition-colors hover:bg-[--var-border-color] hover:text-white dark:border-none dark:bg-[--var-dark-border-color] dark:text-[--var-dark-fg-color] dark:hover:text-white"
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
