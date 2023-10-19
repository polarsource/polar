import { SubscriptionTier } from '@polar-sh/sdk'
import Link from 'next/link'
import { PrimaryButton } from 'polarkit/components/ui/atoms'
import SubscriptionTierCard from './SubscriptionTierCard'

interface PublicSubscriptionUpsellProps {
  subscriptionTiers: SubscriptionTier[]
  subscribePath: string
}

const PublicSubscriptionUpsell: React.FC<PublicSubscriptionUpsellProps> = ({
  subscriptionTiers,
  subscribePath,
}) => {
  return (
    <div className="flex flex-col py-6">
      <div className="flex flex-row items-center justify-between">
        <h2 className="text-2xl">Subscriptions</h2>
        <PrimaryButton fullWidth={false}>View all Tiers</PrimaryButton>
      </div>
      <div className="flex flex-row gap-6 pb-6 pt-10">
        {subscriptionTiers
          .filter((tier) => tier.is_highlighted)
          .sort((a, b) => a.price_amount - b.price_amount)
          .map((tier) => (
            <SubscriptionTierCard subscriptionTier={tier}>
              <Link
                className="w-full"
                href={{
                  pathname: subscribePath,
                  query: { tier: tier.id },
                }}
              >
                <PrimaryButton
                  classNames="bg-[--var-border-color] dark:bg-[--var-dark-border-color] hover:bg-[--var-border-color] text-[--var-fg-color] dark:text-[--var-dark-fg-color] hover:border-[--var-muted-color] dark:hover:border-[--var-dark-muted-color] transition-colors hover:text-white dark:hover:text-white border border-transparent"
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
