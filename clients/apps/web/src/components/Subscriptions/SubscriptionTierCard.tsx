'use client'

import { BenefitList } from '@/components/Products/BenefitList'
import {
  useRecurringBillingLabel,
  useRecurringProductPrice,
} from '@/hooks/products'
import { markdownOptionsJustText } from '@/utils/markdown'
import { schemas } from '@polar-sh/client'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@polar-sh/ui/components/atoms/Card'
import { formatCurrencyAndAmount } from '@polar-sh/ui/lib/money'
import Markdown from 'markdown-to-jsx'
import { twMerge } from 'tailwind-merge'

export interface SubscriptionTierCardProps {
  subscriptionTier: schemas['ProductStorefront']
  className?: string
  recurringInterval?: schemas['SubscriptionRecurringInterval']
}

const SubscriptionTierCard: React.FC<SubscriptionTierCardProps> = ({
  subscriptionTier,
  className,
  recurringInterval = 'month',
}) => {
  const price = useRecurringProductPrice(subscriptionTier, recurringInterval)
  const recurringBillingLabel = useRecurringBillingLabel(
    price ? price.recurring_interval : null,
  )

  const hasBenefits = (subscriptionTier.benefits?.length ?? 0) > 0

  return (
    <Card
      id={subscriptionTier.name}
      className={twMerge(
        'dark:bg-polar-900 relative flex flex-col gap-y-6 overflow-hidden rounded-4xl border-none border-gray-200 bg-gray-100 transition-opacity hover:bg-gray-50 hover:opacity-50',
        className,
      )}
    >
      <CardHeader className="flex grow gap-y-6 p-8 pb-0">
        <h3 className="text-2xl">{subscriptionTier.name}</h3>
      </CardHeader>
      <CardContent
        className={twMerge(
          'flex h-full grow flex-col gap-y-6 px-8 py-0',
          hasBenefits ? 'pb-0' : 'pb-8',
        )}
      >
        <div className="text-4xl font-light">
          {price ? (
            <>
              {price.amount_type === 'fixed' && (
                <>
                  {formatCurrencyAndAmount(
                    price.price_amount,
                    price.price_currency,
                    0,
                  )}
                  <span className="dark:text-polar-500 ml-2 text-xl font-normal text-gray-500">
                    {recurringBillingLabel}
                  </span>
                </>
              )}
              {price.amount_type === 'custom' && (
                <span className="text-[min(1em,32px)]">Pay what you want</span>
              )}
              {price.amount_type === 'free' && (
                <span className="text-[min(1em,32px)]">Free</span>
              )}
            </>
          ) : (
            '$0'
          )}
        </div>
        {subscriptionTier.description && (
          <div className="prose dark:prose-invert dark:text-polar-500 shrink leading-normal text-gray-500">
            <Markdown options={markdownOptionsJustText}>
              {subscriptionTier.description}
            </Markdown>
          </div>
        )}
      </CardContent>
      {(subscriptionTier.benefits?.length ?? 0) > 0 && (
        <CardFooter className="flex w-full flex-col items-start p-3 pt-0">
          <div className="dark:bg-polar-800 flex w-full flex-col gap-y-3 rounded-3xl bg-white p-5">
            <h3 className="text-sm font-medium">Included</h3>
            <div className="flex flex-col gap-y-2">
              <BenefitList benefits={subscriptionTier.benefits} />
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

export default SubscriptionTierCard
