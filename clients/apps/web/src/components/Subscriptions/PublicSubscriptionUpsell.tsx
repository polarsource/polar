import { Organization, SubscriptionTier } from '@polar-sh/sdk'
import Link from 'next/link'
import { PrimaryButton } from 'polarkit/components/ui/atoms'
import SubscriptionTierCard from './SubscriptionTierCard'

interface PublicSubscriptionUpsellProps {
  organization: Organization
  subscriptionTiers: SubscriptionTier[]
  subscribePath: string
}

const PublicSubscriptionUpsell: React.FC<PublicSubscriptionUpsellProps> = ({
  organization,
  subscriptionTiers,
  subscribePath,
}) => {
  return (
    <div className="flex flex-col py-6">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-xl">Subscriptions</h2>
          <p className="dark:text-polar-400 mt-3 text-gray-400">
            Say thanks with a subscription & gain benefits as a bonus
          </p>
        </div>
        <Link href={{ pathname: `/${organization.name}/subscriptions` }}>
          <PrimaryButton fullWidth={false}>View all Tiers</PrimaryButton>
        </Link>
      </div>
      <div className="flex h-fit flex-row gap-6 pb-6 pt-10">
        {subscriptionTiers
          .filter((tier) => tier.is_highlighted)
          .sort((a, b) => a.price_amount - b.price_amount)
          .map((tier) => (
            <SubscriptionTierCard
              className="w-full"
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
                <PrimaryButton
                  classNames="bg-[--var-border-color] hover:bg-[--var-border-color] dark:bg-[--var-dark-border-color] text-[--var-fg-color] dark:text-[--var-dark-fg-color] transition-colors hover:text-white dark:hover:text-white"
                  fullWidth
                >
                  Subscribe
                </PrimaryButton>
              </Link>
            </SubscriptionTierCard>
          ))}
      </div>
    </div>
  )
}

export default PublicSubscriptionUpsell
