'use client'

import {
  useRecurringBillingLabel,
  useRecurringProductPrice,
} from '@/hooks/products'
import { Product, SubscriptionRecurringInterval } from '@polar-sh/sdk'
import Markdown from 'markdown-to-jsx'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from 'polarkit/components/ui/atoms/card'
import { formatCurrencyAndAmount } from 'polarkit/lib/money'
import { twMerge } from 'tailwind-merge'
import { resolveBenefitIcon } from '../Benefit/utils'
import { markdownOpts } from '../Feed/Markdown/markdown'

export interface SubscriptionTierCardProps {
  subscriptionTier: Partial<Product>
  className?: string
  recurringInterval?: SubscriptionRecurringInterval
}

const SubscriptionTierCard: React.FC<SubscriptionTierCardProps> = ({
  subscriptionTier,
  className,
  recurringInterval = SubscriptionRecurringInterval.MONTH,
}) => {
  const price = useRecurringProductPrice(subscriptionTier, recurringInterval)
  const recurringBillingLabel = useRecurringBillingLabel(
    price ? price.recurring_interval : null,
  )

  return (
    <Card
      id={subscriptionTier.name}
      className={twMerge(
        'dark:bg-polar-900 rounded-4xl dark:border-polar-700 relative flex flex-col gap-y-6 overflow-hidden border border-gray-100 p-8 transition-opacity hover:bg-gray-50 hover:opacity-50',
        className,
      )}
    >
      <CardHeader className="flex grow gap-y-6 p-0">
        <h3 className={twMerge('truncate text-lg font-medium')}>
          {subscriptionTier.name}
        </h3>
      </CardHeader>
      <CardContent className="flex h-full grow flex-col gap-y-6 p-0">
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
          <div
            className={twMerge(
              'prose dark:prose-invert prose-headings:mt-8 prose-headings:font-semibold prose-headings:text-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-h4:text-lg prose-h5:text-md dark:prose-headings:text-polar-50 dark:text-polar-300 max-h-64 max-w-4xl overflow-hidden leading-normal text-gray-800',
            )}
          >
            <Markdown
              options={{
                ...markdownOpts,
                overrides: {
                  ...markdownOpts.overrides,
                  a: (props) => (
                    <a {...props} rel="noopener noreferrer nofollow" />
                  ),
                },
              }}
            >
              {subscriptionTier.description}
            </Markdown>
          </div>
        )}
      </CardContent>
      {(subscriptionTier.benefits?.length ?? 0) > 0 && (
        <CardFooter className="flex w-full flex-col items-start gap-y-2 p-0">
          {subscriptionTier.benefits?.map((benefit) => (
            <div key={benefit.id} className="flex flex-row align-middle">
              <span className="dark:bg-polar-700 flex h-6 w-6 shrink-0 flex-row items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-500 dark:text-white">
                {resolveBenefitIcon(benefit, 'inherit', 'h-3 w-3')}
              </span>
              <span className="ml-4 text-sm">{benefit.description}</span>
            </div>
          ))}
        </CardFooter>
      )}
    </Card>
  )
}

export default SubscriptionTierCard
