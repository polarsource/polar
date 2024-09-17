import { FreeTierSubscribe } from '@/components/Organization/FreeTierSubscribe'
import CheckoutButton from '@/components/Products/CheckoutButton'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { useSortable } from '@dnd-kit/sortable'
import {
  Organization,
  Product,
  SubscriptionRecurringInterval,
  SubscriptionTierType,
} from '@polar-sh/sdk'
import { twMerge } from 'tailwind-merge'

export interface DraggableSubscriptionTierCardProps {
  organization: Organization
  subscriptionTier: Product & { type: SubscriptionTierType }
  recurringInterval: SubscriptionRecurringInterval
  subscribeButton: boolean
  disabled?: boolean
  className?: string
}

export const DraggableSubscriptionTierCard = ({
  organization,
  subscribeButton,
  subscriptionTier,
  recurringInterval,
  disabled,
  className,
}: DraggableSubscriptionTierCardProps) => {
  const draggable = useSortable({ id: subscriptionTier.id })

  return (
    <SubscriptionTierCard
      className={twMerge('w-full self-stretch md:max-w-[260px]', className)}
      subscriptionTier={subscriptionTier}
      recurringInterval={recurringInterval}
      variant="small"
      draggable={disabled ? undefined : draggable}
    >
      {subscribeButton ? (
        <>
          {subscriptionTier.type === 'free' ? (
            <FreeTierSubscribe
              product={subscriptionTier}
              organization={organization}
            />
          ) : (
            <CheckoutButton
              organization={organization}
              product={subscriptionTier}
              recurringInterval={recurringInterval}
              checkoutPath="/api/checkout"
            >
              Subscribe
            </CheckoutButton>
          )}
        </>
      ) : null}
    </SubscriptionTierCard>
  )
}
