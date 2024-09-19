import CheckoutButton from '@/components/Products/CheckoutButton'
import SubscriptionTierCard from '@/components/Subscriptions/SubscriptionTierCard'
import { useSortable } from '@dnd-kit/sortable'
import {
  Organization,
  Product,
  SubscriptionRecurringInterval,
} from '@polar-sh/sdk'
import { twMerge } from 'tailwind-merge'

export interface DraggableSubscriptionTierCardProps {
  organization: Organization
  subscriptionTier: Product
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
      {subscribeButton && (
        <CheckoutButton
          organization={organization}
          product={subscriptionTier}
          recurringInterval={recurringInterval}
          checkoutPath="/api/checkout"
        >
          Subscribe
        </CheckoutButton>
      )}
    </SubscriptionTierCard>
  )
}
